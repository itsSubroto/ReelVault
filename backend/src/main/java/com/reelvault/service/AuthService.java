package com.reelvault.service;

import com.reelvault.dto.*;
import com.reelvault.entity.Collection;
import com.reelvault.entity.User;
import com.reelvault.exception.BadRequestException;
import com.reelvault.exception.ResourceNotFoundException;
import com.reelvault.repository.CollectionRepository;
import com.reelvault.repository.UserRepository;
import com.reelvault.security.JwtService;
import com.reelvault.security.PasswordService;
import com.reelvault.security.UserContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final CollectionRepository collectionRepository;
    private final PasswordService passwordService;
    private final JwtService jwtService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String username = request.username().trim().toLowerCase();
        String email = request.email().trim().toLowerCase();

        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new BadRequestException("Username '" + username + "' is already taken");
        }

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new BadRequestException("Email '" + email + "' is already registered");
        }

        String hashedPassword = passwordService.hashPassword(request.password().trim());

        User user = User.builder()
                .username(username)
                .email(email)
                .password(hashedPassword)
                .name(request.name() != null && !request.name().isBlank() ? request.name().trim() : username)
                .build();

        User savedUser = userRepository.save(user);
        log.info("Registered new user: {} ({})", savedUser.getUsername(), savedUser.getId());

        // Create a default "Favorites" collection for the new user
        Collection defaultCollection = Collection.builder()
                .name("Favorites")
                .description("Default collection for your favorite saved reels")
                .user(savedUser)
                .build();
        collectionRepository.save(defaultCollection);

        String token = jwtService.generateToken(savedUser);
        return new AuthResponse(token, toUserResponse(savedUser));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String identifier = request.usernameOrEmail().trim().toLowerCase();

        Optional<User> userOpt = userRepository.findByUsernameIgnoreCase(identifier)
                .or(() -> userRepository.findByEmailIgnoreCase(identifier));

        if (userOpt.isEmpty()) {
            throw new BadRequestException("Invalid username/email or password");
        }

        User user = userOpt.get();

        if (!passwordService.verifyPassword(request.password().trim(), user.getPassword())) {
            throw new BadRequestException("Invalid username/email or password");
        }

        log.info("User logged in successfully: {}", user.getUsername());
        String token = jwtService.generateToken(user);
        return new AuthResponse(token, toUserResponse(user));
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser() {
        User user = UserContext.getCurrentUser();
        if (user == null) {
            throw new ResourceNotFoundException("No authenticated user found in current context");
        }
        return toUserResponse(user);
    }

    private UserResponse toUserResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getName(),
                user.getCreatedAt()
        );
    }
}
