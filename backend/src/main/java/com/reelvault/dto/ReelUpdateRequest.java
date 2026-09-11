package com.reelvault.dto;

import com.reelvault.entity.ReelStatus;

import java.util.List;

public record ReelUpdateRequest(
    String caption,
    String transcript,
    String summary,
    List<String> tags,
    ReelStatus status
) {}
