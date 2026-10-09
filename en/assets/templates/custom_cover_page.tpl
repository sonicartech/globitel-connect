<div>

    {% if config.site_name %}
        <h1>{{ config.site_name }}</h1>
    {% endif %}
    <img src="../assets/logo-dark.png" />
</div>


<table>

    {% if config.site_description %}
    <tr>
        <td>Description</td>
        <td>{{ config.site_description }}</td>
    </tr>
    {% endif %}

    {% if config.site_author %}
    <tr>
        <td>Author</td>
        <td>{{ config.site_author }}</td>
    </tr>
    {% endif %}

    {% if config.copyright %}
    <tr>
        <td>Copyright</td>
        <td>{{ config.copyright }}</td>
    </tr>
    {% endif %}

</table>
