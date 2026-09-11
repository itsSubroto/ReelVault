package com.reelvault.dto;

import java.time.Instant;
import java.util.UUID;

public record CollectionResponse(
    UUID id,
    String name,
    String description,
    long reelCount,
    Instant createdAt,
    Instant updatedAt
) {}
