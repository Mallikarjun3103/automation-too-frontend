FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .


ARG REACT_APP_URL
ENV REACT_APP_URL=$REACT_APP_URL


RUN npm run build

FROM nginx:alpine
COPY --from=0 /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
