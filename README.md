## loopback-connector-orientdb

`loopback-connector-orientdb` is the OrientDB connector module for [loopback-datasource-juggler](https://github.com/strongloop/loopback-datasource-juggler/).


## Installation

````sh
npm install loopback-connector-orientdb --save
````

## Basic use

To use it you need `loopback-datasource-juggler`.

1. Setup dependencies in `package.json`:

    ```json
    {
      ...
      "dependencies": {
        "loopback-datasource-juggler": "latest",
        "loopback-connector-orientdb": "latest"
      },
      ...
    }
    ```

2. Use:

    ```javascript
        var DataSource = require('loopback-datasource-juggler').DataSource;
        var dataSource = new DataSource('orientdb', {
            host: 'localhost',
            port: 3306,
            database: 'mydb',
            username: 'myuser',
            password: 'mypass'
        });
    ```
    You can optionally pass a few additional parameters supported by [`oriento`](https://github.com/codemix/oriento),
