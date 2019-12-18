#!/bin/bash
cd `dirname $0`/../
cp functions.env .env
# this depends on resolving the function entry point through main in package.json
gcloud functions deploy npm-publish-service --runtime nodejs10 --trigger-http --entry-point server