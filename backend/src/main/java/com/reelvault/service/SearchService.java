package com.reelvault.service;

import com.reelvault.dto.ReelResponse;
import com.reelvault.entity.Reel;
import com.reelvault.entity.ReelStatus;
import com.reelvault.entity.User;
import com.reelvault.exception.BadRequestException;
import com.reelvault.repository.ReelRepository;
import com.reelvault.repository.ReelVectorRepository;
import com.reelvault.repository.ReelVectorRepository.ScoredReelId;
import com.reelvault.security.UserContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SearchService {

    public static final int RRF_K = 60;

    public enum SearchMode {
        KEYWORD,
        SEMANTIC,
        HYBRID;

        public static SearchMode fromParam(String raw) {
            if (raw == null || raw.isBlank()) {
                return HYBRID;
            }
            return switch (raw.trim().toLowerCase(Locale.ROOT)) {
                case "keyword", "fts" -> KEYWORD;
                case "semantic", "vector" -> SEMANTIC;
                case "hybrid", "rrf" -> HYBRID;
                default -> throw new BadRequestException(
                        "Invalid search mode '" + raw + "'. Supported modes: keyword, semantic, hybrid");
            };
        }
    }

    private final ReelRepository reelRepository;
    private final ReelVectorRepository reelVectorRepository;
    private final AiEmbeddingClient aiEmbeddingClient;
    private final ReelService reelService;

    @Transactional(readOnly = true)
    public List<ReelResponse> search(String query, UUID collectionId) {
        return search(query, collectionId, "hybrid", 30);
    }

    @Transactional(readOnly = true)
    public List<ReelResponse> search(String query, UUID collectionId, String modeParam, int limit) {
        if (query == null || query.isBlank()) {
            return reelService.getReels(collectionId);
        }

        SearchMode mode = SearchMode.fromParam(modeParam);
        int effectiveLimit = Math.max(1, Math.min(limit, 100));
        int candidateLimit = Math.max(effectiveLimit * 3, 60);

        User user = UserContext.getCurrentUser();
        UUID userId = (user != null) ? user.getId() : null;
        String trimmedQuery = query.trim();

        return switch (mode) {
            case KEYWORD -> executeKeywordSearch(trimmedQuery, userId, collectionId, effectiveLimit, candidateLimit);
            case SEMANTIC -> executeSemanticSearch(trimmedQuery, userId, collectionId, effectiveLimit, candidateLimit);
            case HYBRID -> executeHybridSearch(trimmedQuery, userId, collectionId, effectiveLimit, candidateLimit);
        };
    }

    private List<ReelResponse> executeKeywordSearch(
            String query, UUID userId, UUID collectionId, int limit, int candidateLimit) {
        List<ScoredReelId> kwScores = reelVectorRepository.keywordSearch(query, userId, collectionId, candidateLimit);
        if (kwScores.isEmpty()) {
            return List.of();
        }
        Map<UUID, Reel> reelMap = loadReelsMap(kwScores);
        List<RankedCandidate> ranked = deduplicateRanked(kwScores, reelMap, collectionId == null);

        return ranked.stream()
                .limit(limit)
                .map(c -> reelService.toResponse(c.reel()).withSearchMeta("Keyword Match", null, null))
                .toList();
    }

    private List<ReelResponse> executeSemanticSearch(
            String query, UUID userId, UUID collectionId, int limit, int candidateLimit) {
        AiEmbeddingClient.EmbeddingResult queryEmb = aiEmbeddingClient.embedText(query, "RETRIEVAL_QUERY");
        List<ScoredReelId> semScores = reelVectorRepository.semanticSearch(
                queryEmb.vector(), userId, collectionId, candidateLimit);
        if (semScores.isEmpty()) {
            return List.of();
        }
        Map<UUID, Reel> reelMap = loadReelsMap(semScores);
        List<RankedCandidate> ranked = deduplicateRanked(semScores, reelMap, collectionId == null);

        return ranked.stream()
                .limit(limit)
                .map(c -> reelService.toResponse(c.reel())
                        .withSearchMeta("Semantic Match", roundScore(c.score()), null))
                .toList();
    }

    private List<ReelResponse> executeHybridSearch(
            String query, UUID userId, UUID collectionId, int limit, int candidateLimit) {
        List<ScoredReelId> kwScores = reelVectorRepository.keywordSearch(query, userId, collectionId, candidateLimit);

        List<ScoredReelId> semScores = List.of();
        try {
            AiEmbeddingClient.EmbeddingResult queryEmb = aiEmbeddingClient.embedText(query, "RETRIEVAL_QUERY");
            semScores = reelVectorRepository.semanticSearch(
                    queryEmb.vector(), userId, collectionId, candidateLimit);
        } catch (Exception e) {
            log.warn("Semantic retrieval unavailable during hybrid search, falling back to keyword results: {}",
                    e.getMessage());
        }

        if (kwScores.isEmpty() && semScores.isEmpty()) {
            return List.of();
        }

        List<ScoredReelId> combined = new ArrayList<>(kwScores.size() + semScores.size());
        combined.addAll(kwScores);
        combined.addAll(semScores);
        Map<UUID, Reel> reelMap = loadReelsMap(combined);

        boolean deduplicateByShortcode = (collectionId == null);
        List<RankedCandidate> kwRanked = deduplicateRanked(kwScores, reelMap, deduplicateByShortcode);
        List<RankedCandidate> semRanked = deduplicateRanked(semScores, reelMap, deduplicateByShortcode);

        Map<String, Integer> kwRankMap = new HashMap<>();
        Map<String, Reel> canonicalReelMap = new LinkedHashMap<>();
        for (int i = 0; i < kwRanked.size(); i++) {
            RankedCandidate c = kwRanked.get(i);
            kwRankMap.put(c.key(), i + 1);
            canonicalReelMap.putIfAbsent(c.key(), c.reel());
        }

        Map<String, Integer> semRankMap = new HashMap<>();
        Map<String, Double> semSimMap = new HashMap<>();
        for (int i = 0; i < semRanked.size(); i++) {
            RankedCandidate c = semRanked.get(i);
            semRankMap.put(c.key(), i + 1);
            semSimMap.put(c.key(), c.score());
            canonicalReelMap.putIfAbsent(c.key(), c.reel());
        }

        record HybridEntry(Reel reel, String matchType, Double similarityScore, double rrfScore) {}

        List<HybridEntry> fused = new ArrayList<>(canonicalReelMap.size());
        for (Map.Entry<String, Reel> entry : canonicalReelMap.entrySet()) {
            String key = entry.getKey();
            Integer kwRank = kwRankMap.get(key);
            Integer semRank = semRankMap.get(key);

            double rrf = 0.0;
            if (kwRank != null) {
                rrf += 1.0 / (RRF_K + kwRank);
            }
            if (semRank != null) {
                rrf += 1.0 / (RRF_K + semRank);
            }

            String matchType;
            if (kwRank != null && semRank != null) {
                matchType = "Hybrid Match";
            } else if (semRank != null) {
                matchType = "Semantic Match";
            } else {
                matchType = "Keyword Match";
            }

            Double similarity = semRank != null ? roundScore(semSimMap.get(key)) : null;
            fused.add(new HybridEntry(entry.getValue(), matchType, similarity, roundScore(rrf)));
        }

        fused.sort(Comparator
                .comparingDouble(HybridEntry::rrfScore).reversed()
                .thenComparing(e -> e.similarityScore() != null ? e.similarityScore() : -1.0, Comparator.reverseOrder())
                .thenComparing(e -> e.reel().getCreatedAt(), Comparator.nullsLast(Comparator.reverseOrder())));

        return fused.stream()
                .limit(limit)
                .map(e -> reelService.toResponse(e.reel())
                        .withSearchMeta(e.matchType(), e.similarityScore(), e.rrfScore()))
                .toList();
    }

    private Map<UUID, Reel> loadReelsMap(List<ScoredReelId> scoredIds) {
        if (scoredIds.isEmpty()) {
            return Map.of();
        }
        Set<UUID> ids = scoredIds.stream().map(ScoredReelId::reelId).collect(Collectors.toSet());
        Map<UUID, Reel> map = new HashMap<>(ids.size());
        for (Reel r : reelRepository.findAllById(ids)) {
            map.put(r.getId(), r);
        }
        return map;
    }

    private record RankedCandidate(String key, Reel reel, double score) {}

    private List<RankedCandidate> deduplicateRanked(
            List<ScoredReelId> scoredIds, Map<UUID, Reel> reelMap, boolean deduplicateByShortcode) {
        Map<String, RankedCandidate> dedup = new LinkedHashMap<>();
        for (ScoredReelId s : scoredIds) {
            Reel reel = reelMap.get(s.reelId());
            if (reel == null) {
                continue;
            }
            String key = canonicalKey(reel, deduplicateByShortcode);
            RankedCandidate existing = dedup.get(key);
            if (existing == null) {
                dedup.put(key, new RankedCandidate(key, reel, s.score()));
            } else if (existing.reel().getStatus() != ReelStatus.DONE && reel.getStatus() == ReelStatus.DONE) {
                dedup.put(key, new RankedCandidate(key, reel, Math.max(existing.score(), s.score())));
            }
        }
        return new ArrayList<>(dedup.values());
    }

    private static String canonicalKey(Reel reel, boolean deduplicateByShortcode) {
        if (!deduplicateByShortcode) {
            return reel.getId().toString();
        }
        if (reel.getShortcode() != null && !reel.getShortcode().isBlank()) {
            return reel.getShortcode().trim();
        }
        if (reel.getInstagramUrl() != null && !reel.getInstagramUrl().isBlank()) {
            return reel.getInstagramUrl().trim();
        }
        return reel.getId().toString();
    }

    private static double roundScore(double val) {
        return Math.round(val * 10000.0) / 10000.0;
    }
}
