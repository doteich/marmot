<script setup lang="ts">

import { OnyxButton } from "sit-onyx";
import { ref } from "vue"

const options = [
    {
        "value": "tank_barrel",
        "label": "Barrel Tank"
    },
    {
        "value": "tank_pin",
        "label": "Pin Bottom Tank"
    },
    {
        "value": "tank_roundes",
        "label": "Round Bottom Tank"
    }
]


</script>

<template>

  <OnyxButton label="Click me" />
</template>