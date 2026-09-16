package com.reelvault.dto;

import java.time.Instant;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String username,
        String email,
        String name,
        Instant createdAt
) {}
