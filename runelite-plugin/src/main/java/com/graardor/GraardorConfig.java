package com.graardor;

import net.runelite.client.config.Config;
import net.runelite.client.config.ConfigGroup;
import net.runelite.client.config.ConfigItem;

@ConfigGroup("graardor")
public interface GraardorConfig extends Config
{
    @ConfigItem(
        keyName = "baseUrl",
        name = "Graardor base URL",
        description = "Base URL for item links"
    )
    default String baseUrl()
    {
        return "https://www.graardor.com";
    }
}
