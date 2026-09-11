package com.reelvault.service;

import com.reelvault.dto.CollectionRequest;
import com.reelvault.dto.CollectionResponse;
import com.reelvault.entity.Collection;
import com.reelvault.exception.ResourceNotFoundException;
import com.reelvault.repository.CollectionRepository;
import com.reelvault.repository.ReelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CollectionService {

    private final CollectionRepository collectionRepository;
    private final ReelRepository reelRepository;

    @Transactional(readOnly = true)
    public List<CollectionResponse> getAllCollections() {
        return collectionRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public CollectionResponse getCollectionById(UUID id) {
        Collection collection = findEntityById(id);
        return toResponse(collection);
    }

    @Transactional
    public CollectionResponse createCollection(CollectionRequest request) {
        Collection collection = Collection.builder()
                .name(request.name().trim())
                .description(request.description() != null ? request.description().trim() : null)
                .build();

        Collection saved = collectionRepository.save(collection);
        return toResponse(saved);
    }

    @Transactional
    public void deleteCollection(UUID id) {
        Collection collection = findEntityById(id);
        collectionRepository.delete(collection);
    }

    public Collection findEntityById(UUID id) {
        return collectionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Collection not found with id: " + id));
    }

    private CollectionResponse toResponse(Collection collection) {
        long count = reelRepository.countByCollectionId(collection.getId());
        return new CollectionResponse(
                collection.getId(),
                collection.getName(),
                collection.getDescription(),
                count,
                collection.getCreatedAt(),
                collection.getUpdatedAt()
        );
    }
}
