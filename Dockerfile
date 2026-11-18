# Lightweight static PWA image for Google Cloud Run (Nginx on port 8080)
FROM nginx:alpine

# Replace default port-80 server config with Cloud Run port-8080 config
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy all static PWA files into Nginx html root
COPY public/ /usr/share/nginx/html/

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
