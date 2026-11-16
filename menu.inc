<?php

$menuEntries = array(
    array(
        'text' => 'Touch Dashboard',
        'type' => 'status',
        'page' => 'status.php',
        'wrap' => 0
    )
);

foreach ($menuEntries as $entry) {
    if ($entry['type'] != $menu) {
        continue;
    }

    $nopage = (isset($entry['wrap']) && $entry['wrap'] == 0) ? '&nopage=1' : '';
    printf(
        "<li><a href='plugin.php?_menu=%s&plugin=%s&page=%s%s'>%s</a></li>\n",
        htmlspecialchars($menu, ENT_QUOTES, 'UTF-8'),
        htmlspecialchars($plugin, ENT_QUOTES, 'UTF-8'),
        htmlspecialchars($entry['page'], ENT_QUOTES, 'UTF-8'),
        $nopage,
        htmlspecialchars($entry['text'], ENT_QUOTES, 'UTF-8')
    );
}
?>
