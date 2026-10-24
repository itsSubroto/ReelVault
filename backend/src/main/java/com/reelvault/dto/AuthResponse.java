package com.reelvault.dto;

public record AuthResponse(
        String token,
        UserResponse user
) {}
