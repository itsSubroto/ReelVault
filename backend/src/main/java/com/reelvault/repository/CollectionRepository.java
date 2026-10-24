package com.reelvault.repository;

import com.reelvault.entity.Collection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CollectionRepository extends JpaRepository<Collection, UUID> {
    List<Collection> findAllByOrderByCreatedAtDesc();

    List<Collection> findByUserIdOrderByCreatedAtDesc(UUID userId);

    boolean existsByNameIgnoreCase(String name);

    boolean existsByUserIdAndNameIgnoreCase(UUID userId, String name);
}
