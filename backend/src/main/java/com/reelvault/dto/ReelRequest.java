package com.reelvault.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record ReelRequest(
    @NotBlank(message = "Video URL is required")
    String url,

    UUID collectionId
) {}

