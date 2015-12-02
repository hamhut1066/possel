This readme is to help those working on the frontend.

There are several dependencies that need to be included.

They can be installed as followed:

    gem install jekyll
    npm install

you will need to run two commands, (one to generate the html and the second to compile the react code).

(This is assuming that you have possel up and running).

    jekyll build # This will build the html.
    babel react/*.jsx --out-file _site/js/ui.js # This compiles and concatenates the React into a single output file.

There are (TODO) plans to integrate a docker development environment to ease development of the project.

