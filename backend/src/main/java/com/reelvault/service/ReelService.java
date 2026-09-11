package com.reelvault.service;

import com.reelvault.dto.ReelRequest;
import com.reelvault.dto.ReelResponse;
import com.reelvault.dto.ReelUpdateRequest;
import com.reelvault.entity.Collection;
import com.reelvault.entity.Reel;
import com.reelvault.entity.ReelStatus;
import com.reelvault.exception.ResourceNotFoundException;
import com.reelvault.repository.ReelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReelService {

    private final ReelRepository reelRepository;
    private final CollectionService collectionService;
    private final InstagramService instagramService;

    @Transactional
    public ReelResponse saveReel(ReelRequest request) {
        Collection collection = collectionService.findEntityById(request.collectionId());

        InstagramService.InstagramMetadata metadata = instagramService.fetchMetadata(request.url());

        Reel reel = Reel.builder()
                .collection(collection)
                .instagramUrl(request.url().trim())
                .shortcode(metadata.shortcode())
                .caption(metadata.caption())
                .thumbnailUrl(metadata.thumbnailUrl())
                .authorName(metadata.authorName())
                .status(ReelStatus.SAVED)
                .tags(new ArrayList<>())
                .build();

        Reel saved = reelRepository.save(reel);
        log.info("Saved reel shortcode: {} to collection: {}", saved.getShortcode(), collection.getName());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<ReelResponse> getReels(UUID collectionId) {
        List<Reel> reels;
        if (collectionId != null) {
            reels = reelRepository.findByCollectionIdOrderByCreatedAtDesc(collectionId);
        } else {
            reels = reelRepository.findAllByOrderByCreatedAtDesc();
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
