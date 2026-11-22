package com.reelvault.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.reelvault.entity.User;
import com.reelvault.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class AuthInterceptor implements HandlerInterceptor {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // Always allow CORS pre-flight OPTIONS requests
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String uri = request.getRequestURI();
        String method = request.getMethod();

        // 1. Extract and validate Bearer token first if present
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();
            if (jwtService.validateToken(token)) {
                UUID userId = jwtService.extractUserId(token);
                if (userId != null) {
                    User user = userRepository.findById(userId).orElse(null);
                    if (user != null) {
                        UserContext.setCurrentUser(user);
                    }
                }
            }
        }

        // 2. Public endpoints (do not require authentication)
        // Note: /api/auth/login and /api/auth/register are public, but /api/auth/me requires authentication!
        if (uri.matches("^/api/auth/(login|register)/?$") ||
            uri.startsWith("/api/health") ||
            uri.startsWith("/h2-console")) {
            return true;
        }

        // 3. Allow Python AI service PATCH callback on reels without user token
        if ("PATCH".equalsIgnoreCase(method) && uri.matches("^/api/reels/[^/]+$")) {
            return true;
        }

        // 4. Allow reel status check endpoint (handles both authenticated and unauthenticated queries)
        if (uri.startsWith("/api/reels/check")) {
            return true;
        }

        // 5. Protected endpoints (including /api/auth/me, /api/reels, /api/collections, /api/search):
        // Must have an authenticated user in context
        if (UserContext.getCurrentUser() != null) {
            return true;
        }

        // 6. Unauthorized response
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        Map<String, Object> errorBody = Map.of(
                "status", HttpServletResponse.SC_UNAUTHORIZED,
                "error", "Unauthorized",
                "message", "Valid authentication token is required"
        );
        response.getWriter().write(objectMapper.writeValueAsString(errorBody));
        return false;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        UserContext.clear();
    }
}
