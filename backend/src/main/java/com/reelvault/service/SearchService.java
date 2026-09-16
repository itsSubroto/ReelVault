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

        com.reelvault.entity.User user = com.reelvault.security.UserContext.getCurrentUser();
        String trimmedQuery = query.trim();
        List<Reel> results;

        if (user != null) {
            if (collectionId != null) {
                results = reelRepository.searchByUserAndCollectionAndCaption(user.getId(), collectionId, trimmedQuery);
            } else {
                results = reelRepository.searchByUserAndCaption(user.getId(), trimmedQuery);
            }
        } else {
            if (collectionId != null) {
                results = reelRepository.searchByCollectionAndCaption(collectionId, trimmedQuery);
            } else {
                results = reelRepository.searchByCaption(trimmedQuery);
            }
        }

        String[] tokens = trimmedQuery.split("\\s+");
        if (tokens.length > 1) {
            java.util.LinkedHashMap<UUID, Reel> map = new java.util.LinkedHashMap<>();
            for (Reel r : results) {
                map.put(r.getId(), r);
            }
            for (String token : tokens) {
                if (token.length() >= 2) {
                    List<Reel> tokenResults;
                    if (user != null) {
                        tokenResults = (collectionId != null)
                                ? reelRepository.searchByUserAndCollectionAndCaption(user.getId(), collectionId, token)
                                : reelRepository.searchByUserAndCaption(user.getId(), token);
                    } else {
                        tokenResults = (collectionId != null)
                                ? reelRepository.searchByCollectionAndCaption(collectionId, token)
                                : reelRepository.searchByCaption(token);
                    }
                    for (Reel tr : tokenResults) {
                        map.putIfAbsent(tr.getId(), tr);
                    }
                }
            }
            results = new java.util.ArrayList<>(map.values());
        }

        return results.stream().map(reelService::toResponse).toList();
    }
}
