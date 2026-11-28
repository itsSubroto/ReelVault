package com.reelvault.service;

import com.reelvault.entity.EmbeddingStatus;
import com.reelvault.entity.Reel;
import com.reelvault.repository.ReelRepository;
import com.reelvault.repository.ReelVectorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmbeddingBackfillService {

    private final ReelRepository reelRepository;
    private final ReelVectorRepository reelVectorRepository;
    private final AiEmbeddingClient aiEmbeddingClient;

    @Transactional
    public Map<String, Object> backfillMissingEmbeddings(boolean force, int batchSize, Integer limit) {
        int effectiveLimit = (limit != null && limit > 0) ? limit : 500;
        int effectiveBatchSize = Math.max(1, Math.min(batchSize, 64));

        List<UUID> candidateIds = reelVectorRepository.findBackfillCandidateIds(force, effectiveLimit);
        int totalCandidates = candidateIds.size();
        int succeeded = 0;
        int failed = 0;
        String lastModel = null;

        for (int start = 0; start < totalCandidates; start += effectiveBatchSize) {
            int end = Math.min(start + effectiveBatchSize, totalCandidates);
            List<UUID> chunkIds = candidateIds.subList(start, end);
            List<Reel> reels = reelRepository.findAllById(chunkIds);

            for (Reel reel : reels) {
                try {
                    String docText = AiEmbeddingClient.buildDocumentText(
                            reel.getCaption(),
                            reel.getTranscript(),
                            reel.getSummary(),
                            reel.getTags(),
                            reel.getAuthorName()
                    );
                    AiEmbeddingClient.EmbeddingResult result =
                            aiEmbeddingClient.embedText(docText, "RETRIEVAL_DOCUMENT");

                    reelVectorRepository.saveEmbedding(
                            reel.getId(),
                            result.vector(),
                            result.model(),
                            EmbeddingStatus.DONE
                    );
                    succeeded++;
                    lastModel = result.model();
                } catch (Exception e) {
                    failed++;
                    log.warn("Failed to backfill embedding for reel {}: {}", reel.getId(), e.getMessage());
                    reelVectorRepository.saveEmbedding(
                            reel.getId(),
                            null,
                            null,
                            EmbeddingStatus.FAILED
                    );
                }
            }
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("force", force);
        response.put("totalCandidates", totalCandidates);
        response.put("processed", succeeded + failed);
        response.put("succeeded", succeeded);
        response.put("failed", failed);
        response.put("model", lastModel);
        response.put("statusCounts", reelVectorRepository.getEmbeddingStatusCounts());
        return response;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getEmbeddingStatusSummary() {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalReels", reelRepository.count());
        summary.put("statusCounts", reelVectorRepository.getEmbeddingStatusCounts());
        return summary;
    }
}
