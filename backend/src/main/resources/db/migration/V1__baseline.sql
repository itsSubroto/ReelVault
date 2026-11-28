-- V1 Baseline schema for ReelVault (used on fresh DBs; existing DBs are baselined at V1)

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS reels (
    id UUID PRIMARY KEY,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    instagram_url VARCHAR(1000) NOT NULL,
    shortcode VARCHAR(100) NOT NULL,
    caption TEXT,
    thumbnail_url VARCHAR(2000),
    video_url VARCHAR(3000),
    author_name VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'SAVED',
    transcript TEXT,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS reel_tags (
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    tag VARCHAR(100)
);
