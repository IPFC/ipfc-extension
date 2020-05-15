# base image
FROM node:12.2.0-alpine

# set working directory
WORKDIR /src

# add `/app/node_modules/.bin` to $PATH
ENV PATH /src/node_modules/.bin:$PATH

# install and cache app dependencies
COPY package.json /src/package.json
RUN npm install
#build
RUN npm run build
RUN npm run build-zip
# #make zip
# CMD ["npm", "run", "build-zip"]

