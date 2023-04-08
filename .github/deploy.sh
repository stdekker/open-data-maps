#!/bin/bash
set -e

# Connect to SFTP server
lftp -c "open -u $SFTP_USERNAME,$SFTP_PASSWORD $SFTP_HOST"

# Upload files
lftp -c "mirror -R -e -x .git -x .github -x README.md -x deploy.sh $GITHUB_WORKSPACE /public_html"
