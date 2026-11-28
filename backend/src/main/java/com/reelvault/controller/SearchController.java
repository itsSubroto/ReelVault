package com.reelvault.controller;

import com.reelvault.dto.ReelResponse;
import com.reelvault.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @GetMapping
    public ResponseEntity<List<ReelResponse>> search(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false) UUID collectionId,
            @RequestParam(required = false, defaultValue = "hybrid") String mode,
            @RequestParam(required = false, defaultValue = "30") int limit) {
        return ResponseEntity.ok(searchService.search(q, collectionId, mode, limit));
    }
}
