package com.reelvault;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.reelvault.dto.CollectionRequest;
import com.reelvault.dto.CollectionResponse;
import com.reelvault.dto.ReelRequest;
import com.reelvault.dto.ReelResponse;
import com.reelvault.repository.CollectionRepository;
import com.reelvault.repository.ReelRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class ReelVaultApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ReelRepository reelRepository;

    @Autowired
    private CollectionRepository collectionRepository;

    @Autowired
    private com.reelvault.repository.UserRepository userRepository;

    @Autowired
    private com.reelvault.security.JwtService jwtService;

    private String authToken;
    private com.reelvault.entity.User testUser;

    @BeforeEach
    void setUp() {
        reelRepository.deleteAll();
        collectionRepository.deleteAll();
        userRepository.deleteAll();

        testUser = userRepository.save(com.reelvault.entity.User.builder()
                .username("testuser")
                .email("test@example.com")
                .password("encoded_pass")
                .name("Test User")
                .build());
        authToken = jwtService.generateToken(testUser);
    }

    @Test
    void shouldCreateAndListCollections() throws Exception {
        CollectionRequest request = new CollectionRequest("Tech Tips", "Cool tech tricks");

        MvcResult createResult = mockMvc.perform(post("/api/collections")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.name").value("Tech Tips"))
                .andExpect(jsonPath("$.description").value("Cool tech tricks"))
                .andExpect(jsonPath("$.reelCount").value(0))
                .andReturn();

        CollectionResponse createdCollection = objectMapper.readValue(
                createResult.getResponse().getContentAsString(), CollectionResponse.class);

        mockMvc.perform(get("/api/collections")
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].name").value("Tech Tips"));

        mockMvc.perform(get("/api/collections/" + createdCollection.id())
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(createdCollection.id().toString()));
    }

    @Test
    void shouldSaveAndRetrieveReel() throws Exception {
        // 1. Create collection
        CollectionRequest colReq = new CollectionRequest("Workouts", "Fitness reels");
        MvcResult colResult = mockMvc.perform(post("/api/collections")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(colReq)))
                .andExpect(status().isCreated())
                .andReturn();

        CollectionResponse collection = objectMapper.readValue(
                colResult.getResponse().getContentAsString(), CollectionResponse.class);

        // 2. Save Reel
        ReelRequest reelReq = new ReelRequest(
                "https://www.instagram.com/reel/C7xyz123abc/",
                collection.id()
        );

        MvcResult reelResult = mockMvc.perform(post("/api/reels")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reelReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.shortcode").value("C7xyz123abc"))
                .andExpect(jsonPath("$.collectionId").value(collection.id().toString()))
                .andExpect(jsonPath("$.status").value("SAVED"))
                .andReturn();

        ReelResponse savedReel = objectMapper.readValue(
                reelResult.getResponse().getContentAsString(), ReelResponse.class);

        // 3. Verify collection now reports reelCount = 1
        mockMvc.perform(get("/api/collections")
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].reelCount").value(1));

        // 4. List reels by collection
        mockMvc.perform(get("/api/reels?collectionId=" + collection.id())
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(savedReel.id().toString()));

        // 5. Get single reel
        mockMvc.perform(get("/api/reels/" + savedReel.id())
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(savedReel.id().toString()));
    }

    @Test
    void shouldSearchReelsByCaption() throws Exception {
        // Create collection
        CollectionRequest colReq = new CollectionRequest("Coding", "Software development");
        MvcResult colResult = mockMvc.perform(post("/api/collections")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(colReq)))
                .andExpect(status().isCreated())
                .andReturn();
        CollectionResponse collection = objectMapper.readValue(
                colResult.getResponse().getContentAsString(), CollectionResponse.class);

        // Save reel
        ReelRequest reelReq = new ReelRequest("https://www.instagram.com/reel/C9test999/", collection.id());
        MvcResult reelResult = mockMvc.perform(post("/api/reels")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reelReq)))
                .andExpect(status().isCreated())
                .andReturn();
        ReelResponse reel = objectMapper.readValue(reelResult.getResponse().getContentAsString(), ReelResponse.class);

        // Update caption with specific searchable keywords (PATCH callback is public or authenticated)
        mockMvc.perform(patch("/api/reels/" + reel.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"caption\": \"Mastering docker containers and kubernetes tips\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.caption").value("Mastering docker containers and kubernetes tips"));

        // Search for "docker"
        mockMvc.perform(get("/api/search?q=docker")
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(reel.id().toString()));

        // Search for "unrelated" should return empty
        mockMvc.perform(get("/api/search?q=unrelatedterm")
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void shouldReturn400ForInvalidUrl() throws Exception {
        CollectionRequest colReq = new CollectionRequest("Misc", "Misc");
        MvcResult colResult = mockMvc.perform(post("/api/collections")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(colReq)))
                .andExpect(status().isCreated())
                .andReturn();
        CollectionResponse collection = objectMapper.readValue(
                colResult.getResponse().getContentAsString(), CollectionResponse.class);

        ReelRequest invalidReq = new ReelRequest("https://example.com/not-an-instagram-reel", collection.id());
        mockMvc.perform(post("/api/reels")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("Invalid Instagram URL")));
    }

    @Test
    void shouldQuickSaveReelWithDefaultCollection() throws Exception {
        // Save reel without collectionId - should auto-create "Quick Save" collection
        ReelRequest quickReq = new ReelRequest("https://www.youtube.com/shorts/dQw4w9WgXcQ", null);
        MvcResult result = mockMvc.perform(post("/api/reels")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(quickReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.shortcode").value("dQw4w9WgXcQ"))
                .andExpect(jsonPath("$.collectionName").value("Quick Save"))
                .andReturn();

        // Verify "Quick Save" collection is in collections list
        mockMvc.perform(get("/api/collections")
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.name == 'Quick Save')]").exists());

        // Verify check endpoint recognizes this video as saved
        mockMvc.perform(get("/api/reels/check?url=https://www.youtube.com/shorts/dQw4w9WgXcQ")
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saved").value(true))
                .andExpect(jsonPath("$.reel.shortcode").value("dQw4w9WgXcQ"));
    }

    @Test
    void shouldCheckHealthEndpoint() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("ReelVault API"));
    }
}
