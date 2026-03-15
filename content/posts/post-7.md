---
title: "Sample Post 7: PostgreSQL Performance Tuning"
date: 2026-03-08T12:00:00+03:00
draft: false
tags: ["kubernetes", "til"]
description: "A practical guide to debugging Linux kernel issues using ftrace, perf, and eBPF. Real examples from tracking down a mysterious latency spike."
---

When things break in production, you learn fast. The key insight is that simplicity beats cleverness every time.

## The Problem

I have been thinking about this topic for a while and finally decided to write it up.

## The Approach

We introduced caching at the application layer and the database load dropped by 60%.

## Lessons Learned

The best infrastructure is the one nobody has to think about.
