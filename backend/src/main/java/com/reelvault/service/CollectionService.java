package com.reelvault.service;

import com.reelvault.dto.CollectionRequest;
import com.reelvault.dto.CollectionResponse;
import com.reelvault.entity.Collection;
import com.reelvault.entity.User;
import com.reelvault.exception.BadRequestException;
import com.reelvault.exception.ResourceNotFoundException;
import com.reelvault.repository.CollectionRepository;
import com.reelvault.repository.ReelRepository;
import com.reelvault.security.UserContext;
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
        User user = UserContext.getCurrentUser();
        List<Collection> collections = (user != null)
                ? collectionRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                : collectionRepository.findAllByOrderByCreatedAtDesc();

        return collections.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public CollectionResponse getCollectionById(UUID id) {
        Collection collection = findEntityById(id);
        return toResponse(collection);
    }

    @Transactional
    public CollectionResponse createCollection(CollectionRequest request) {
        User user = UserContext.getCurrentUser();
        String trimmedName = request.name().trim();

        boolean exists = (user != null)
                ? collectionRepository.existsByUserIdAndNameIgnoreCase(user.getId(), trimmedName)
                : collectionRepository.existsByNameIgnoreCase(trimmedName);

        if (exists) {
            throw new BadRequestException("A collection with the name '" + trimmedName + "' already exists");
        }

        Collection collection = Collection.builder()
                .name(trimmedName)
                .description(request.description() != null ? request.description().trim() : null)
                .user(user)
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
