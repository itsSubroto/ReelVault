package com.reelvault.controller;

import com.reelvault.service.EmbeddingBackfillService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/embeddings")
@RequiredArgsConstructor
public class AdminController {

    private final EmbeddingBackfillService embeddingBackfillService;

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getEmbeddingStatus() {
        return ResponseEntity.ok(embeddingBackfillService.getEmbeddingStatusSummary());
    }

    @PostMapping("/backfill")
    public ResponseEntity<Map<String, Object>> backfillEmbeddings(
            @RequestParam(defaultValue = "false") boolean force,
            @RequestParam(defaultValue = "16") int batchSize,
            @RequestParam(required = false) Integer limit) {
        return ResponseEntity.ok(embeddingBackfillService.backfillMissingEmbeddings(force, batchSize, limit));
    }
}
