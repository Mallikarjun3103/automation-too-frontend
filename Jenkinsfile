
pipeline {
    agent any

    environment {
        DEPLOY_DIR = '/home/ubuntu/noat/frontend'
        BRANCH = 'staging'
    }

    stages {
        stage('Code Checkout') {
            steps {
                checkout scm

                echo 'Jenkins workspace checkout completed'
            }
        }

        stage('Update Deployment Code') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'Git-creds',
                        usernameVariable: 'GIT_USERNAME',
                        passwordVariable: 'GIT_TOKEN'
                    )
                ]) {
                    sh '''
                        set -eu
                        set +x

                        echo "Deployment directory: $DEPLOY_DIR"
                        echo "Target branch: $BRANCH"

                        export GIT_ASKPASS="$(mktemp)"
                        trap 'rm -f "$GIT_ASKPASS"' EXIT

                        cat > "$GIT_ASKPASS" <<'EOF'
#!/bin/sh
case "$1" in
    *Username*) printf '%s\\n' "$GIT_USERNAME" ;;
    *Password*) printf '%s\\n' "$GIT_TOKEN" ;;
    *) exit 1 ;;
esac
EOF

                        chmod 700 "$GIT_ASKPASS"
                        export GIT_TERMINAL_PROMPT=0

                        cd "$DEPLOY_DIR"

                        git rev-parse --is-inside-work-tree
                        git pull origin "$BRANCH"

                        echo "Deployment directory code update completed"
                    '''
                }
            }
        }
    }
}
