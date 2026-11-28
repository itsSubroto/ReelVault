package com.reelvault.dto;

import com.reelvault.entity.EmbeddingStatus;
import com.reelvault.entity.ReelStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ReelResponse(
    UUID id,
    UUID collectionId,
    String collectionName,
    String instagramUrl,
    String shortcode,
    String caption,
    String thumbnailUrl,
    String videoUrl,
    String authorName,
    ReelStatus status,
    String transcript,
    String summary,
    List<String> tags,
    Instant createdAt,
    Instant updatedAt,
    String embeddingModel,
    EmbeddingStatus embeddingStatus,
    String matchType,
    Double similarityScore,
    Double rrfScore
) {
    public ReelResponse withSearchMeta(String matchType, Double similarityScore, Double rrfScore) {
        return new ReelResponse(
                id,
                collectionId,
                collectionName,
                instagramUrl,
                shortcode,
                caption,
                thumbnailUrl,
                videoUrl,
                authorName,
                status,
                transcript,
                summary,
                tags,
                createdAt,
                updatedAt,
                embeddingModel,
                embeddingStatus,
                matchType,
                similarityScore,
                rrfScore
        );
    }
}
