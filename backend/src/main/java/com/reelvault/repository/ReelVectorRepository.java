package com.reelvault.repository;

import com.reelvault.entity.EmbeddingStatus;
import com.reelvault.entity.Reel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Repository
@Slf4j
public class ReelVectorRepository {

    private final JdbcTemplate jdbcTemplate;
    private final ReelRepository reelRepository;
    private final boolean postgres;

    // Used only in non-PostgreSQL (H2) test environments where pgvector is unavailable.
    private final Map<UUID, float[]> h2VectorStore = new ConcurrentHashMap<>();

    public record ScoredReelId(UUID reelId, double score) {}

    public ReelVectorRepository(JdbcTemplate jdbcTemplate, ReelRepository reelRepository, DataSource dataSource) {
        this.jdbcTemplate = jdbcTemplate;
        this.reelRepository = reelRepository;
        this.postgres = detectPostgres(dataSource);
        log.info("ReelVectorRepository initialized (postgresMode={})", this.postgres);
    }

    private boolean detectPostgres(DataSource dataSource) {
        try (Connection conn = dataSource.getConnection()) {
            String product = conn.getMetaData().getDatabaseProductName();
            return product != null && product.toLowerCase(Locale.ROOT).contains("postgresql");
        } catch (Exception e) {
            log.warn("Could not detect database product, assuming non-PostgreSQL fallback: {}", e.getMessage());
            return false;
        }
    }

    public boolean isPostgres() {
        return postgres;
    }

    public void clearTestVectors() {
        h2VectorStore.clear();
    }

    public boolean hasVector(UUID reelId) {
        if (!postgres) {
            return h2VectorStore.containsKey(reelId);
        }
        Boolean exists = jdbcTemplate.queryForObject(
                "SELECT (embedding IS NOT NULL) FROM reels WHERE id = ?",
                Boolean.class,
                reelId
        );
        return Boolean.TRUE.equals(exists);
    }

    public void saveEmbedding(UUID reelId, float[] vector, String model, EmbeddingStatus status) {
        Instant now = Instant.now();
        if (postgres) {
            if (vector != null && vector.length > 0) {
                String literal = formatPgvector(vector);
                jdbcTemplate.update(
                        "UPDATE reels SET embedding = CAST(? AS vector), embedding_model = ?, embedding_status = ?, embedding_updated_at = ? WHERE id = ?",
                        literal,
                        model,
                        status.name(),
                        Timestamp.from(now),
                        reelId
                );
            } else {
                jdbcTemplate.update(
                        "UPDATE reels SET embedding_model = COALESCE(?, embedding_model), embedding_status = ?, embedding_updated_at = ? WHERE id = ?",
                        model,
                        status.name(),
                        Timestamp.from(now),
                        reelId
                );
            }
            return;
        }

        // H2 fallback for test suite
        if (vector != null && vector.length > 0) {
            h2VectorStore.put(reelId, vector);
        }
        reelRepository.findById(reelId).ifPresent(reel -> {
            if (model != null) {
                reel.setEmbeddingModel(model);
            }
            reel.setEmbeddingStatus(status);
            reel.setEmbeddingUpdatedAt(now);
            reelRepository.save(reel);
        });
    }

    public void copyEmbedding(UUID sourceReelId, UUID targetReelId) {
        if (sourceReelId == null || targetReelId == null) {
            return;
        }
        if (postgres) {
            jdbcTemplate.update(
                    """
                    UPDATE reels target
                    SET embedding = src.embedding,
                        embedding_model = src.embedding_model,
                        embedding_status = src.embedding_status,
                        embedding_updated_at = src.embedding_updated_at
                    FROM reels src
                    WHERE src.id = ? AND target.id = ? AND src.embedding IS NOT NULL
                    """,
                    sourceReelId,
                    targetReelId
            );
            return;
        }
        float[] vec = h2VectorStore.get(sourceReelId);
        if (vec != null) {
            h2VectorStore.put(targetReelId, Arrays.copyOf(vec, vec.length));
        }
    }

    public List<UUID> findBackfillCandidateIds(boolean force, int limit) {
        if (postgres) {
            String sql = """
                    SELECT id
                    FROM reels
                    WHERE (? = true OR embedding IS NULL OR embedding_status IS DISTINCT FROM 'DONE')
                    ORDER BY created_at DESC
                    LIMIT ?
                    """;
            return jdbcTemplate.query(
                    sql,
                    (rs, rowNum) -> UUID.fromString(rs.getString("id")),
                    force,
                    limit
            );
        }

        return reelRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(r -> force || r.getEmbeddingStatus() != EmbeddingStatus.DONE || !h2VectorStore.containsKey(r.getId()))
                .limit(limit)
                .map(Reel::getId)
                .toList();
    }

    public List<ScoredReelId> keywordSearch(String query, UUID userId, UUID collectionId, int limit) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        String trimmed = query.trim();

        if (postgres) {
            String sql = """
                    WITH q AS (
                      SELECT
                        NULLIF(websearch_to_tsquery('english', ?), ''::tsquery) AS and_q,
                        NULLIF(replace(plainto_tsquery('english', ?)::text, ' & ', ' | ')::tsquery, ''::tsquery) AS or_q
                    ),
                    doc AS (
                      SELECT r.id,
                             (
                               setweight(to_tsvector('english', COALESCE(r.caption, '')), 'A') ||
                               setweight(to_tsvector('english', COALESCE(r.summary, '')), 'A') ||
                               setweight(to_tsvector('english', COALESCE(r.transcript, '')), 'B') ||
                               setweight(to_tsvector('english', COALESCE(r.author_name, '')), 'C') ||
                               setweight(to_tsvector('english', COALESCE((
                                 SELECT string_agg(rt.tag, ' ') FROM reel_tags rt WHERE rt.reel_id = r.id
                               ), '')), 'A')
                             ) AS tsv
                      FROM reels r
                      JOIN collections c ON c.id = r.collection_id
                      WHERE (?::uuid IS NULL OR c.user_id IS NULL OR c.user_id = ?::uuid)
                        AND (?::uuid IS NULL OR r.collection_id = ?::uuid)
                    )
                    SELECT doc.id,
                           (COALESCE(CASE WHEN q.and_q IS NOT NULL THEN ts_rank_cd(doc.tsv, q.and_q) * 2.0 ELSE 0 END, 0) +
                            COALESCE(CASE WHEN q.or_q IS NOT NULL THEN ts_rank_cd(doc.tsv, q.or_q) ELSE 0 END, 0)) AS fts_score
                    FROM doc, q
                    WHERE (q.and_q IS NOT NULL AND doc.tsv @@ q.and_q)
                       OR (q.or_q IS NOT NULL AND doc.tsv @@ q.or_q)
                    ORDER BY fts_score DESC
                    LIMIT ?
                    """;
            return jdbcTemplate.query(
                    sql,
                    (rs, rowNum) -> new ScoredReelId(
                            UUID.fromString(rs.getString("id")),
                            rs.getDouble("fts_score")
                    ),
                    trimmed,
                    trimmed,
                    userId, userId,
                    collectionId, collectionId,
                    limit
            );
        }

        // H2 fallback full-text simulation for unit/integration tests
        String[] tokens = Arrays.stream(trimmed.toLowerCase(Locale.ROOT).split("\\s+"))
                .filter(t -> t.length() >= 2)
                .toArray(String[]::new);
        if (tokens.length == 0) {
            return List.of();
        }

        List<Reel> candidates = loadScopedReels(userId, collectionId);
        List<ScoredReelId> scored = new ArrayList<>();
        String fullLower = trimmed.toLowerCase(Locale.ROOT);
        for (Reel r : candidates) {
            String haystack = buildSearchableText(r);
            double score = 0.0;
            if (haystack.contains(fullLower)) {
                score += 2.0;
            }
            for (String tok : tokens) {
                if (haystack.contains(tok)) {
                    score += 1.0;
                }
            }
            if (score > 0.0) {
                scored.add(new ScoredReelId(r.getId(), score));
            }
        }
        scored.sort(Comparator.comparingDouble(ScoredReelId::score).reversed());
        return scored.size() > limit ? scored.subList(0, limit) : scored;
    }

    public List<ScoredReelId> semanticSearch(float[] queryVector, UUID userId, UUID collectionId, int limit) {
        if (queryVector == null || queryVector.length == 0) {
            return List.of();
        }

        if (postgres) {
            String literal = formatPgvector(queryVector);
            String sql = """
                    SELECT r.id, (1.0 - (r.embedding <=> CAST(? AS vector))) AS similarity
                    FROM reels r
                    JOIN collections c ON c.id = r.collection_id
                    WHERE r.embedding IS NOT NULL
                      AND r.embedding_status = 'DONE'
                      AND (?::uuid IS NULL OR c.user_id IS NULL OR c.user_id = ?::uuid)
                      AND (?::uuid IS NULL OR r.collection_id = ?::uuid)
                    ORDER BY r.embedding <=> CAST(? AS vector) ASC
                    LIMIT ?
                    """;
            return jdbcTemplate.query(
                    sql,
                    (rs, rowNum) -> new ScoredReelId(
                            UUID.fromString(rs.getString("id")),
                            rs.getDouble("similarity")
                    ),
                    literal,
                    userId, userId,
                    collectionId, collectionId,
                    literal,
                    limit
            );
        }

        // H2 fallback cosine similarity for unit/integration tests
        List<Reel> candidates = loadScopedReels(userId, collectionId);
        List<ScoredReelId> scored = new ArrayList<>();
        for (Reel r : candidates) {
            if (r.getEmbeddingStatus() != EmbeddingStatus.DONE) {
                continue;
            }
            float[] docVec = h2VectorStore.get(r.getId());
            if (docVec == null || docVec.length == 0) {
                continue;
            }
            double sim = cosineSimilarity(queryVector, docVec);
            if (sim > 0.0) {
                scored.add(new ScoredReelId(r.getId(), sim));
            }
        }
        scored.sort(Comparator.comparingDouble(ScoredReelId::score).reversed());
        return scored.size() > limit ? scored.subList(0, limit) : scored;
    }

    public Map<String, Long> getEmbeddingStatusCounts() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (EmbeddingStatus status : EmbeddingStatus.values()) {
            counts.put(status.name(), 0L);
        }
        if (postgres) {
            jdbcTemplate.query(
                    "SELECT embedding_status, COUNT(*) AS cnt FROM reels GROUP BY embedding_status",
                    rs -> {
                        counts.put(rs.getString("embedding_status"), rs.getLong("cnt"));
                    }
            );
        } else {
            for (Reel r : reelRepository.findAll()) {
                String key = (r.getEmbeddingStatus() != null ? r.getEmbeddingStatus() : EmbeddingStatus.PENDING).name();
                counts.put(key, counts.getOrDefault(key, 0L) + 1L);
            }
        }
        return counts;
    }

    private List<Reel> loadScopedReels(UUID userId, UUID collectionId) {
        if (userId != null) {
            if (collectionId != null) {
                return reelRepository.findByCollectionIdAndCollectionUserIdOrderByCreatedAtDesc(collectionId, userId);
            }
            return reelRepository.findByCollectionUserIdOrderByCreatedAtDesc(userId);
        }
        if (collectionId != null) {
            return reelRepository.findByCollectionIdOrderByCreatedAtDesc(collectionId);
        }
        return reelRepository.findAllByOrderByCreatedAtDesc();
    }

    private static String buildSearchableText(Reel r) {
        String tags = r.getTags() != null ? String.join(" ", r.getTags()) : "";
        return (
                Objects.toString(r.getCaption(), "") + " " +
                Objects.toString(r.getSummary(), "") + " " +
                Objects.toString(r.getTranscript(), "") + " " +
                Objects.toString(r.getAuthorName(), "") + " " +
                tags
        ).toLowerCase(Locale.ROOT);
    }

    public static String formatPgvector(float[] vec) {
        StringBuilder sb = new StringBuilder(vec.length * 10);
        sb.append('[');
        for (int i = 0; i < vec.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(vec[i]);
        }
        sb.append(']');
        return sb.toString();
    }

    public static double cosineSimilarity(float[] a, float[] b) {
        int len = Math.min(a.length, b.length);
        double dot = 0.0;
        double normA = 0.0;
        double normB = 0.0;
        for (int i = 0; i < len; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        double denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom > 1e-12 ? (dot / denom) : 0.0;
    }
}
