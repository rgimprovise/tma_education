# Правильная конфигурация Caddy для TMA

## Блок для порта 80 (IP адрес)

```caddy
:80 {
    # Backend API
    handle /api/* {
        uri strip_prefix /api
        reverse_proxy localhost:3000
    }

    # TMA Frontend
    handle {
        root * /var/www/tma_education/tma/dist
        file_server
        try_files {path} /index.html
    }
}
```

## Блок для поддомена (рекомендуется)

```caddy
tma.n8nrgimprovise.space {
    encode gzip
    
    # Backend API
    handle /api/* {
        uri strip_prefix /api
        reverse_proxy localhost:3000
    }
    
    # TMA Frontend
    handle {
        root * /var/www/tma_education/tma/dist
        file_server
        try_files {path} /index.html
    }
}
```

## Важно

- Используйте `uri strip_prefix /api` вместо `rewrite /api /strip_prefix`
- Директива `uri strip_prefix` должна быть ДО `reverse_proxy`
- Порядок `handle` блоков важен: более специфичные пути должны быть первыми

