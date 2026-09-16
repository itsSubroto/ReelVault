package com.reelvault.security;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.reelvault.entity.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class JwtService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final long EXPIRATION_DAYS = 7;

    private final ObjectMapper objectMapper;
    private final byte[] secretKeyBytes;

    public JwtService(
            ObjectMapper objectMapper,
            @Value("${reelvault.jwt.secret:reelvault-secure-jwt-secret-key-32-chars-minimum!}") String secretKey) {
        this.objectMapper = objectMapper;
        this.secretKeyBytes = secretKey.getBytes(StandardCharsets.UTF_8);
    }

    public String generateToken(User user) {
        try {
            Instant now = Instant.now();
            Instant expiry = now.plus(EXPIRATION_DAYS, ChronoUnit.DAYS);

            Map<String, Object> header = Map.of(
                    "alg", "HS256",
                    "typ", "JWT"
            );

            Map<String, Object> payload = Map.of(
                    "sub", user.getId().toString(),
                    "username", user.getUsername(),
                    "email", user.getEmail(),
                    "iat", now.getEpochSecond(),
                    "exp", expiry.getEpochSecond()
            );

            String encodedHeader = base64UrlEncode(objectMapper.writeValueAsString(header).getBytes(StandardCharsets.UTF_8));
            String encodedPayload = base64UrlEncode(objectMapper.writeValueAsString(payload).getBytes(StandardCharsets.UTF_8));

            String dataToSign = encodedHeader + "." + encodedPayload;
            String signature = base64UrlEncode(hmacSha256(dataToSign, secretKeyBytes));

            return dataToSign + "." + signature;
        } catch (Exception e) {
            log.error("Failed to generate JWT: {}", e.getMessage());
            throw new IllegalStateException("Could not generate authentication token", e);
        }
    }

    public boolean validateToken(String token) {
        try {
            if (token == null || token.isBlank()) return false;

            String[] parts = token.split("\\.");
            if (parts.length != 3) return false;

            String dataToSign = parts[0] + "." + parts[1];
            String expectedSignature = base64UrlEncode(hmacSha256(dataToSign, secretKeyBytes));

            if (!expectedSignature.equals(parts[2])) {
                return false;
            }

            // Check expiration
            byte[] payloadBytes = base64UrlDecode(parts[1]);
            Map<String, Object> payload = objectMapper.readValue(payloadBytes, new TypeReference<>() {});

            if (payload.containsKey("exp")) {
                long exp = ((Number) payload.get("exp")).longValue();
                return Instant.now().getEpochSecond() < exp;
            }

            return true;
        } catch (Exception e) {
            log.debug("Token validation failed: {}", e.getMessage());
            return false;
        }
    }

    public UUID extractUserId(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) return null;

            byte[] payloadBytes = base64UrlDecode(parts[1]);
            Map<String, Object> payload = objectMapper.readValue(payloadBytes, new TypeReference<>() {});

            String sub = (String) payload.get("sub");
            return sub != null ? UUID.fromString(sub) : null;
        } catch (Exception e) {
            log.debug("Failed to extract userId from token: {}", e.getMessage());
            return null;
        }
    }

    private byte[] hmacSha256(String data, byte[] key) throws NoSuchAlgorithmException, InvalidKeyException {
        Mac mac = Mac.getInstance(HMAC_ALGORITHM);
        mac.init(new SecretKeySpec(key, HMAC_ALGORITHM));
        return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
    }

    private String base64UrlEncode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private byte[] base64UrlDecode(String str) {
        return Base64.getUrlDecoder().decode(str);
    }
}
