#!/bin/bash
set -e

echo "Uploading files to $SFTP_HOST"

sftp -oStrictHostKeyChecking=no -oUserKnownHostsFile=/dev/null -b - $SFTP_USERNAME@$SFTP_HOST <<EOF
  cd $SFTP_PATH
  put -r -P ./*
  quit
EOF

echo "Deployment complete"
