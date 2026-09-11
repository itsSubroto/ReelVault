package com.reelvault.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CollectionRequest(
    @NotBlank(message = "Collection name is required")
    @Size(max = 100, message = "Name must not exceed 100 characters")
    String name,

    @Size(max = 255, message = "Description must not exceed 255 characters")
    String description
) {}
