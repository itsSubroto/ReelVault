package com.reelvault.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record ReelRequest(
    @NotBlank(message = "Instagram URL is required")
    String url,

    @NotNull(message = "Collection ID is required")
    UUID collectionId
) {}
