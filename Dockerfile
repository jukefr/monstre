FROM registry.hub.docker.com/library/nginx:alpine 
WORKDIR /usr/share/nginx/html
COPY ./public .
COPY nginx.conf /etc/nginx/
EXPOSE 5000
CMD ["nginx", "-g", "daemon off;"]
