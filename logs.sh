#!/bin/bash
docker compose -f docker-compose.prod.yml logs --tail 100 -f postgres-api frontend
