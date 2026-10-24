package com.reelvault.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.reelvault.dto.ReelRequest;
import com.reelvault.dto.ReelResponse;
import com.reelvault.dto.ReelUpdateRequest;
import com.reelvault.entity.Collection;
import com.reelvault.entity.Reel;
import com.reelvault.entity.ReelStatus;
import com.reelvault.exception.BadRequestException;
import com.reelvault.exception.ResourceNotFoundException;
import com.reelvault.repository.ReelRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Service
@Slf4j
public class ReelService {

    private final ReelRepository reelRepository;
    private final CollectionService collectionService;
    private final InstagramService instagramService;
    private final ObjectMapper objectMapper;

    public ReelService(
            ReelRepository reelRepository,
            CollectionService collectionService,
            InstagramService instagramService,
            ObjectMapper objectMapper) {
        this.reelRepository = reelRepository;
        this.collectionService = collectionService;
        this.instagramService = instagramService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ReelResponse saveReel(ReelRequest request) {
        Collection collection = collectionService.findEntityById(request.collectionId());

        String cleanUrl = request.url().trim();
        String shortcode = instagramService.extractShortcode(cleanUrl);

        // Prevent duplicate reel in the same collection
        if (reelRepository.existsByCollectionIdAndShortcode(collection.getId(), shortcode)) {
            throw new BadRequestException("This reel is already saved in this particular collection");
        }

        // Check if this reel was already enriched in another collection
        Optional<Reel> existingReel = reelRepository.findFirstByShortcode(shortcode);

        Reel reel;
        if (existingReel.isPresent() && existingReel.get().getStatus() == ReelStatus.DONE) {
            Reel existing = existingReel.get();
            log.info("Reel shortcode {} already processed in collection '{}', copying metadata to '{}'",
                    shortcode, existing.getCollection().getName(), collection.getName());
            reel = Reel.builder()
                    .collection(collection)
                    .instagramUrl(cleanUrl)
                    .shortcode(shortcode)
                    .caption(existing.getCaption())
                    .thumbnailUrl(existing.getThumbnailUrl())
                    .authorName(existing.getAuthorName())
                    .transcript(existing.getTranscript())
                    .summary(existing.getSummary())
                    .tags(existing.getTags() != null ? new ArrayList<>(existing.getTags()) : new ArrayList<>())
                    .status(ReelStatus.DONE)
                    .build();

            Reel saved = reelRepository.save(reel);
            return toResponse(saved);
        }

        InstagramService.InstagramMetadata metadata = instagramService.fetchMetadata(cleanUrl);

        reel = Reel.builder()
                .collection(collection)
                .instagramUrl(cleanUrl)
                .shortcode(metadata.shortcode())
                .caption(metadata.caption())
                .thumbnailUrl(metadata.thumbnailUrl())
                .authorName(metadata.authorName())
                .status(ReelStatus.SAVED)
                .tags(new ArrayList<>())
                .build();

        Reel saved = reelRepository.save(reel);
        log.info("Saved reel shortcode: {} to collection: {}", saved.getShortcode(), collection.getName());

        // Asynchronously notify Python AI service
        triggerAiProcessing(saved.getId(), saved.getInstagramUrl());

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<ReelResponse> getReels(UUID collectionId) {
        com.reelvault.entity.User user = com.reelvault.security.UserContext.getCurrentUser();
        List<Reel> reels;
        if (user != null) {
            if (collectionId != null) {
                reels = reelRepository.findByCollectionIdAndCollectionUserIdOrderByCreatedAtDesc(collectionId, user.getId());
            } else {
                reels = reelRepository.findByCollectionUserIdOrderByCreatedAtDesc(user.getId());
            }
        } else {
            if (collectionId != null) {
                reels = reelRepository.findByCollectionIdOrderByCreatedAtDesc(collectionId);
            } else {
                reels = reelRepository.findAllByOrderByCreatedAtDesc();
            }
        }
        return reels.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ReelResponse getReelById(UUID id) {
        Reel reel = findEntityById(id);
        return toResponse(reel);
    }

    @Transactional
    public void deleteReel(UUID id) {
        Reel reel = findEntityById(id);
        reelRepository.delete(reel);
        log.info("Deleted reel id: {}", id);
    }

    @Transactional
    public ReelResponse updateReel(UUID id, ReelUpdateRequest request) {
        Reel reel = findEntityById(id);

        if (request.caption() != null) {
            reel.setCaption(request.caption());
        }
        if (request.thumbnailUrl() != null) {
            reel.setThumbnailUrl(request.thumbnailUrl());
        }
        if (request.authorName() != null) {
            reel.setAuthorName(request.authorName());
        }
        if (request.transcript() != null) {
            reel.setTranscript(request.transcript());
        }
        if (request.summary() != null) {
            reel.setSummary(request.summary());
        }
        if (request.tags() != null) {
            reel.setTags(new ArrayList<>(request.tags()));
        }
        if (request.status() != null) {
            reel.setStatus(request.status());
        }

        Reel updated = reelRepository.save(reel);
        return toResponse(updated);
    }

    public void triggerProcessing(UUID id) {
        Reel reel = findEntityById(id);
        triggerAiProcessing(reel.getId(), reel.getInstagramUrl());
    }

    public Map<String, Object> syncAllReels() {
        try {
            RestTemplate restTemplate = new RestTemplate();

            String jsonBody = "{}";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setContentLength(jsonBody.getBytes(StandardCharsets.UTF_8).length);
            HttpEntity<String> entity = new HttpEntity<>(jsonBody, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    "http://ai-service:8000/api/reprocess-all/",
                    entity,
                    Map.class
            );
            return response.getBody() != null ? response.getBody() : Map.of("status", "sent");
        } catch (Exception e) {
            log.error("Failed to connect to Python AI service: {}", e.getMessage());
            return Map.of("error", "Python AI service is not running on port 8000: " + e.getMessage());
        }
    }

    private void triggerAiProcessing(UUID reelId, String url) {
        CompletableFuture.runAsync(() -> {
            try {
                RestTemplate restTemplate = new RestTemplate();

                Map<String, String> payload = Map.of(
                        "reel_id", reelId.toString(),
                        "instagram_url", url
                );
                String jsonBody = objectMapper.writeValueAsString(payload);

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setContentLength(jsonBody.getBytes(StandardCharsets.UTF_8).length);
                HttpEntity<String> entity = new HttpEntity<>(jsonBody, headers);

                restTemplate.postForEntity("http://ai-service:8000/api/process-reel/", entity, String.class);
                log.info("Successfully triggered AI service for reel: {}", reelId);
            } catch (Exception e) {
                log.warn("Python AI service notification error for reel {}: {}", reelId, e.getMessage());
            }
        });
    }

    public Reel findEntityById(UUID id) {
        return reelRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reel not found with id: " + id));
    }

    public ReelResponse toResponse(Reel reel) {
        return new ReelResponse(
                reel.getId(),
                reel.getCollection().getId(),
                reel.getCollection().getName(),
                reel.getInstagramUrl(),
                reel.getShortcode(),
                reel.getCaption(),
                reel.getThumbnailUrl(),
                reel.getAuthorName(),
                reel.getStatus(),
                reel.getTranscript(),
                reel.getSummary(),
                reel.getTags() != null ? reel.getTags() : List.of(),
                reel.getCreatedAt(),
                reel.getUpdatedAt()
        );
    }
}
