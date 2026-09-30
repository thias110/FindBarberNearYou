#!/bin/bash

PORT="$1"
API_KEY="$2"

export ANTHROPIC_BASE_URL="http://localhost:${PORT}/v1"
export ANTHROPIC_AUTH_TOKEN="$API_KEY"
export ANTHROPIC_MODEL="kr/claude-sonnet-4.5"

echo
echo "Configuration terminée."
echo "URL     : $ANTHROPIC_BASE_URL"
echo "Modèle  : $ANTHROPIC_MODEL"
echo

# a faire dans un projet
# ./claude-router.sh 20128 'TA_CLE_9ROUTER' 'kr/claude-sonnet-4.5'
claude --model "$ANTHROPIC_MODEL"