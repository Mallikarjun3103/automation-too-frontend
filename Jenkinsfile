
pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
    }

    environment {
        DEPLOY_DIR = '/data/AIML_Stagging/NOAT_applictaion/NOAT_frontend'
        COMPOSE_PROJECT_NAME = 'noat_frontend'
        IMAGE = 'noat_frontend_staging'
    }

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
            }
        }

        stage('Validate Configuration') {
            steps {
                sh '''
                    set -eu
                    test -f Dockerfile
                    test -f package.json
                    test -f package-lock.json

                    cd "$DEPLOY_DIR"
                    test -f docker-compose.yml

                    docker compose \
                      -p "$COMPOSE_PROJECT_NAME" \
                      -f docker-compose.yml config -q

                    echo "Configuration validation passed."
                '''
            }
        }

        stage('Build Frontend Image') {
            steps {
                sh '''
                    set -eu

                    docker build \
                      --build-arg REACT_APP_URL=https://noat.niruthi.com/api \
                      -t "$IMAGE:$BUILD_NUMBER" \
                      .
                '''
            }
        }

        stage('Deploy Frontend') {
            steps {
                sh '''
                    set -eu
                    cd "$DEPLOY_DIR"

                    IMAGE_TAG="$BUILD_NUMBER" docker compose \
                      -p "$COMPOSE_PROJECT_NAME" \
                      -f docker-compose.yml \
                      up -d --no-deps --no-build --force-recreate frontend

                    echo "Frontend deployment command completed."
                '''
            }
        }

        stage('Verify Deployment') {
            steps {
                sh '''
                    set -eu
                    attempt=1

                    while [ "$attempt" -le 15 ]; do
                        running=$(docker inspect \
                          --format '{{.State.Running}}' \
                          noat_frontend_staging 2>/dev/null || true)

                        if [ "$running" = "true" ] &&
                           timeout 2 bash -c \
                           'echo > /dev/tcp/127.0.0.1/3016' \
                           2>/dev/null; then
                            echo "Frontend is running and port 3016 is reachable."
                            exit 0
                        fi

                        echo "Attempt $attempt: waiting for frontend..."
                        sleep 2
                        attempt=$((attempt + 1))
                    done

                    echo "Frontend verification failed."
                    docker logs --tail 100 noat_frontend_staging || true
                    exit 1
                '''
            }
        }
    }

    post {
        success {
            echo 'NOAT frontend staging deployment completed successfully.'
        }
        failure {
            echo 'NOAT frontend deployment failed. Check Console Output.'
        }
    }
}
