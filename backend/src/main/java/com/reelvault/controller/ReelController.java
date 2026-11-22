package com.reelvault.controller;

import com.reelvault.dto.ReelRequest;
import com.reelvault.dto.ReelResponse;
import com.reelvault.dto.ReelUpdateRequest;
import com.reelvault.service.ReelService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/reels")
@RequiredArgsConstructor
public class ReelController {

    private final ReelService reelService;

    @PostMapping
    public ResponseEntity<ReelResponse> saveReel(@Valid @RequestBody ReelRequest request) {
        ReelResponse response = reelService.saveReel(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<ReelResponse>> getReels(@RequestParam(required = false) UUID collectionId) {
        return ResponseEntity.ok(reelService.getReels(collectionId));
    }

    @GetMapping("/check")
    public ResponseEntity<java.util.Map<String, Object>> checkReel(@RequestParam String url) {
        return ResponseEntity.ok(reelService.checkReelStatus(url));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ReelResponse> getReelById(@PathVariable UUID id) {
        return ResponseEntity.ok(reelService.getReelById(id));
    }

    @GetMapping("/{id}/stream")
    public ResponseEntity<Void> streamReel(@PathVariable UUID id) {
        com.reelvault.entity.Reel reel = reelService.findEntityById(id);
        String videoUrl = reel.getVideoUrl();
        if (videoUrl != null && !videoUrl.isBlank()) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(java.net.URI.create(videoUrl))
                    .build();
        }
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(java.net.URI.create(reel.getInstagramUrl()))
                .build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteReel(@PathVariable UUID id) {
        reelService.deleteReel(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ReelResponse> updateReel(
            @PathVariable UUID id,
            @RequestBody ReelUpdateRequest request) {
        return ResponseEntity.ok(reelService.updateReel(id, request));
    }

    @PostMapping("/{id}/process")
    public ResponseEntity<Void> triggerProcessing(@PathVariable UUID id) {
        reelService.triggerProcessing(id);
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/sync-all")
    public ResponseEntity<java.util.Map<String, Object>> syncAllReels() {
        return ResponseEntity.ok(reelService.syncAllReels());
    }
}
