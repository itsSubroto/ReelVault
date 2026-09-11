package com.reelvault.service;

import com.reelvault.dto.ReelResponse;
import com.reelvault.entity.Reel;
import com.reelvault.repository.ReelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SearchService {

    private final ReelRepository reelRepository;
    private final ReelService reelService;

    @Transactional(readOnly = true)
    public List<ReelResponse> search(String query, UUID collectionId) {
        if (query == null || query.isBlank()) {
            return reelService.getReels(collectionId);
        }

        String trimmedQuery = query.trim();
        List<Reel> results;
        if (collectionId != null) {
            results = reelRepository.searchByCollectionAndCaption(collectionId, trimmedQuery);
        } else {
            results = reelRepository.searchByCaption(trimmedQuery);
        }

        return results.stream().map(reelService::toResponse).toList();
    }
}
