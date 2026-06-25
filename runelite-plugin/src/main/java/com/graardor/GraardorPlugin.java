package com.graardor;

import net.runelite.client.plugins.Plugin;
import net.runelite.client.plugins.PluginDescriptor;
import com.google.inject.Provides;
import net.runelite.client.config.ConfigManager;
import javax.inject.Inject;
import net.runelite.client.ui.ClientToolbar;
import net.runelite.client.ui.NavigationButton;
import net.runelite.client.util.ImageUtil;
import java.awt.image.BufferedImage;
import net.runelite.client.util.LinkBrowser;

@PluginDescriptor(
    name = "Graardor",
    description = "Open Graardor item pages from the Grand Exchange",
    tags = {"graardor", "ge", "flip", "prices"}
)
public class GraardorPlugin extends Plugin
{
    @Inject
    private ClientToolbar clientToolbar;

    @Inject
    private GraardorConfig config;

    private NavigationButton navButton;

    @Override
    protected void startUp()
    {
        BufferedImage icon = ImageUtil.loadImageResource(getClass(), "/graardor_icon.png");
        navButton = NavigationButton.builder()
            .tooltip("Open Graardor")
            .icon(icon)
            .onClick(() -> LinkBrowser.browse("https://www.graardor.com/tools/flips"))
            .build();
        clientToolbar.addNavigation(navButton);
    }

    @Override
    protected void shutDown()
    {
        clientToolbar.removeNavigation(navButton);
    }

    @Provides
    GraardorConfig provideConfig(ConfigManager configManager)
    {
        return configManager.getConfig(GraardorConfig.class);
    }
}
