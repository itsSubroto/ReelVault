package com.reelvault;

import com.reelvault.entity.Collection;
import com.reelvault.entity.EmbeddingStatus;
import com.reelvault.entity.Reel;
import com.reelvault.entity.ReelStatus;
import com.reelvault.entity.User;
import com.reelvault.repository.CollectionRepository;
import com.reelvault.repository.ReelRepository;
import com.reelvault.repository.ReelVectorRepository;
import com.reelvault.repository.UserRepository;
import com.reelvault.security.JwtService;
import com.reelvault.service.AiEmbeddingClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class SemanticSearchTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ReelRepository reelRepository;

    @Autowired
    private ReelVectorRepository reelVectorRepository;

    @Autowired
    private CollectionRepository collectionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private AiEmbeddingClient aiEmbeddingClient;

    private String authToken;
    private Collection techCollection;
    private Reel dockerReel;
    private Reel recipeReel;

    private static float[] basisVector(int hotIndex) {
        float[] vec = new float[AiEmbeddingClient.EMBEDDING_DIMENSION];
        vec[hotIndex] = 1.0f;
        return vec;
    }

    @BeforeEach
    void setUp() {
        reelVectorRepository.clearTestVectors();
        reelRepository.deleteAll();
        collectionRepository.deleteAll();
        userRepository.deleteAll();

        User user = userRepository.save(User.builder()
                .username("semuser")
                .email("sem@example.com")
                .password("encoded_pass")
                .name("Semantic User")
                .build());
        authToken = jwtService.generateToken(user);

        techCollection = collectionRepository.save(Collection.builder()
                .name("Knowledge")
                .user(user)
                .build());

        dockerReel = reelRepository.save(Reel.builder()
                .collection(techCollection)
                .instagramUrl("https://www.instagram.com/reel/Cdocker01/")
                .shortcode("Cdocker01")
                .caption("Shipping microservices with containers and kubernetes")
                .summary("Guide to container orchestration")
                .transcript("Use pods and deployment manifests to scale services.")
                .tags(List.of("devops", "k8s"))
                .status(ReelStatus.DONE)
                .embeddingStatus(EmbeddingStatus.DONE)
                .embeddingModel("test-model")
                .build());
        reelVectorRepository.saveEmbedding(dockerReel.getId(), basisVector(0), "test-model", EmbeddingStatus.DONE);

        recipeReel = reelRepository.save(Reel.builder()
                .collection(techCollection)
                .instagramUrl("https://www.instagram.com/reel/Crecipe01/")
                .shortcode("Crecipe01")
                .caption("Quick high protein paneer breakfast bowl")
                .summary("10-minute vegetarian meal prep")
                .transcript("Saute paneer with spices and serve warm.")
                .tags(List.of("food", "protein"))
                .status(ReelStatus.DONE)
                .embeddingStatus(EmbeddingStatus.DONE)
                .embeddingModel("test-model")
                .build());
        reelVectorRepository.saveEmbedding(recipeReel.getId(), basisVector(1), "test-model", EmbeddingStatus.DONE);

        when(aiEmbeddingClient.embedText(anyString(), anyString())).thenAnswer(inv -> {
            String text = inv.getArgument(0, String.class).toLowerCase();
            if (text.contains("container") || text.contains("cloud") || text.contains("orchestration") || text.contains("k8s")) {
                return new AiEmbeddingClient.EmbeddingResult(basisVector(0), "test-model");
            }
            if (text.contains("meal") || text.contains("breakfast") || text.contains("paneer") || text.contains("cook")) {
                return new AiEmbeddingClient.EmbeddingResult(basisVector(1), "test-model");
            }
            return new AiEmbeddingClient.EmbeddingResult(basisVector(2), "test-model");
        });
    }

    @Test
    void hybridSearchFindsContextualReelWithoutExactKeywordMatch() throws Exception {
        // Query uses "scalable cloud infrastructure" which has no substring overlap with dockerReel,
        // but maps semantically to vector basis(0).
        mockMvc.perform(get("/api/search")
                        .header("Authorization", "Bearer " + authToken)
                        .param("q", "scalable cloud infrastructure"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].shortcode").value("Cdocker01"))
                .andExpect(jsonPath("$[0].matchType").value("Semantic Match"))
                .andExpect(jsonPath("$[0].similarityScore").value(closeTo(1.0, 0.001)))
                .andExpect(jsonPath("$[0].rrfScore", greaterThan(0.0)));
    }

    @Test
    void hybridSearchCombinesKeywordAndSemanticIntoHybridMatch() throws Exception {
        // "paneer breakfast" matches both keyword FTS and semantic vector basis(1)
        mockMvc.perform(get("/api/search")
                        .header("Authorization", "Bearer " + authToken)
                        .param("q", "paneer breakfast"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].shortcode").value("Crecipe01"))
                .andExpect(jsonPath("$[0].matchType").value("Hybrid Match"));
    }

    @Test
    void adminBackfillRequiresSecretAndBackfillsPendingReels() throws Exception {
        Reel pendingReel = reelRepository.save(Reel.builder()
                .collection(techCollection)
                .instagramUrl("https://www.youtube.com/shorts/pending01")
                .shortcode("pending01")
                .caption("Healthy meal prep ideas for busy weekdays")
                .status(ReelStatus.DONE)
                .embeddingStatus(EmbeddingStatus.PENDING)
                .build());

        // Missing secret -> 403 Forbidden
        mockMvc.perform(post("/api/admin/embeddings/backfill"))
                .andExpect(status().isForbidden());

        // Valid secret -> 200 OK and reel is embedded
        mockMvc.perform(post("/api/admin/embeddings/backfill")
                        .header("X-Admin-Secret", "test-admin-secret"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCandidates").value(1))
                .andExpect(jsonPath("$.succeeded").value(1))
                .andExpect(jsonPath("$.failed").value(0));

        assertTrue(reelVectorRepository.hasVector(pendingReel.getId()));
    }
}
