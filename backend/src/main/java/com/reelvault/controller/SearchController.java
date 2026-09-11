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
            @RequestParam(required = false) UUID collectionId) {
        return ResponseEntity.ok(searchService.search(q, collectionId));
    }
}
