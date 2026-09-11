package com.reelvault.dto;

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
    String authorName,
    ReelStatus status,
    String transcript,
    String summary,
    List<String> tags,
    Instant createdAt,
    Instant updatedAt
) {}
