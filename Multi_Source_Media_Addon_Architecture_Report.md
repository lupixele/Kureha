# Multi-Source Media Addon Architecture Research Report

## Project Goal

Design a universal addon system capable of connecting multiple content sources and transforming them into a single standardized media experience.

The addon should support:
- Web scraping based sources
- Torrent based sources
- API based sources
- Local/self-hosted sources
- Multiple media types

The core application should not contain source-specific logic.

---

# Core Philosophy

The application handles:
- UI
- Playback
- Library
- User preferences
- Watch history
- Metadata graph
- Addon management

Addons handle:
- Searching sources
- Scraping pages
- API communication
- Torrent indexing
- Stream extraction
- Source ranking

Architecture:

Main App
 |
 Addon Framework
 |
 +-- Web Scrapers
 +-- Torrent Providers
 +-- API Providers
 +-- Local Providers
 |
 Source Resolver
 |
 Playback

---

# Hybrid Model

CloudStream style:
Website -> Scraper -> Video URL -> Player

Torrentio style:
Metadata -> Torrent Search -> Release Matching -> Stream

Combined:

Episode
 |
 Source Discovery
 |
 Streaming + Torrents
 |
 Resolver
 |
 Best Playback

---

# Addon Types

## Web Scraper Addon

Responsibilities:
- Search
- Details extraction
- Episode extraction
- Stream extraction

Interface:

search()
getDetails()
getEpisodes()
getStreams()

---

## Torrent Addon

Responsibilities:
- Search torrent indexes
- Parse release names
- Extract magnets
- Rank releases

---

## API Addon

Used for structured external sources.

---

## Local Media Addon

Used for:
- NAS
- Plex
- Jellyfin
- Local files

---

# Universal Data Model

Every addon converts data into:

Media:
- id
- title
- type
- poster
- description

Episode:
- id
- mediaId
- season
- episode

Stream:
- url
- quality
- language
- source

---

# Metadata Independence

Instead of depending completely on MAL/AniList/TMDB, maintain an internal metadata graph.

The graph stores:
- aliases
- relations
- seasons
- episodes
- specials
- mappings

---

# Identity Matching Engine

The hardest part.

Matching uses:

- Title similarity
- Alias database
- Season
- Episode number
- Release dates
- Relations

Output:

Confidence score.

---

# Special Episode Handling

Specials require explicit mapping.

Support:
- OVA
- ONA
- Movies
- Specials
- Extras

Map external episode IDs to canonical episode IDs.

---

# Source Resolver

Combines all sources.

Ranking factors:

1. User preference
2. Quality
3. Availability
4. Speed
5. Reliability

---

# Background Indexing

For speed:

Background workers:
- Collect popular releases
- Update mappings
- Cache results

Fallback:
Live searching.

---

# Security

Third party addons require:

- Permission system
- Sandboxing
- Network restrictions
- Version checking

---

# Development Roadmap

Phase 1:
Addon framework

Phase 2:
Scraper support

Phase 3:
Torrent support

Phase 4:
Metadata graph

Phase 5:
Resolver engine

---

# Final Goal

A media operating system:

User
 |
 Maro App
 |
 Media Intelligence
 |
 Streaming + Torrents + APIs
 |
 Resolver
 |
 Playback

The addon is not just a scraper. It is a bridge between external media ecosystems and the core application.
