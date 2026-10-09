<div>

    {% if config.site_name %}
        <h1>{{ config.site_name }}</h1>
    {% endif %}
    <img src="../assets/logo-dark.png" />
</div>


<table>

    {% if config.site_description %}
    <tr>
        <td>الوصف</td>
        <td>{{ config.site_description }}</td>
    </tr>
    {% endif %}

    {% if config.site_author %}
    <tr>
        <td>المؤلف</td>
        <td>{{ config.site_author }}</td>
    </tr>
    {% endif %}

    {% if config.copyright %}
    <tr>
        <td>حقوق المؤلف</td>
        <td>{{ config.copyright }}</td>
    </tr>
    {% endif %}

</table>
