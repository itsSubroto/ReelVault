package com.reelvault.repository;

import com.reelvault.entity.Reel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ReelRepository extends JpaRepository<Reel, UUID> {
    
    List<Reel> findAllByOrderByCreatedAtDesc();

    List<Reel> findByCollectionIdOrderByCreatedAtDesc(UUID collectionId);

    long countByCollectionId(UUID collectionId);

    @Query("SELECT r FROM Reel r WHERE (" +
           "LOWER(COALESCE(r.caption, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(r.transcript, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(r.summary, '')) LIKE LOWER(CONCAT('%', :query, '%'))" +
           ") ORDER BY r.createdAt DESC")
    List<Reel> searchByCaption(@Param("query") String query);

    @Query("SELECT r FROM Reel r WHERE r.collection.id = :collectionId AND (" +
           "LOWER(COALESCE(r.caption, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(r.transcript, '')) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(COALESCE(r.summary, '')) LIKE LOWER(CONCAT('%', :query, '%'))" +
           ") ORDER BY r.createdAt DESC")
    List<Reel> searchByCollectionAndCaption(@Param("collectionId") UUID collectionId, @Param("query") String query);
}
