# Plantilla de Especificación (Spec Template)

El archivo `spec.md` guardado **debe contener exactamente** los encabezados que figuran a continuación, en este orden y con estos nombres. Sin encabezados `##` adicionales, sin renombrar y sin omitir secciones. Las líneas de instrucción (este bloque introductorio, los bloques **Llenar:**, **Forma:**, **Vacío:** y las ayudas entre corchetes angulares) nunca deben aparecer en el recapitulativo del chat ni en el archivo final.

Cada oración debe tener trazabilidad directa hacia `idea.md` o hacia una respuesta confirmada de la entrevista. Enfocarse en el **qué** y el **por qué**. Queda estrictamente prohibido incluir detalles de arquitectura, librerías, nombres de archivos, rutas de carpetas o código. El `Estado` inicial es `en-revision` hasta que el usuario responda **Sí** a la pregunta de satisfacción (momento en el cual pasa a `listo-para-plan`).

Si una sección no tiene requisitos settled, usar la palabra de relleno indicada en **Vacío:**. No inventar contenido.

---

# Spec <nnn> <Nombre de la funcionalidad>

Estado: <en-revision | listo-para-plan>

## Contexto y objetivos

**Llenar:** 2 a 5 oraciones en prosa. Heredar e integrar obligatoriamente el **Problema** y la solución de **Qué vamos a hacer** definidos en `idea.md`. Explicar qué dolor o necesidad resuelve esta entrega, por qué vale la pena implementarla ahora y qué significa una mejora para la persona que la utiliza. No realizar un recorrido de pantallas.

**Forma:** prosa fluida, sin viñetas.

### Usuarios y actores

**Llenar:** cada tipo de persona (o sistema en su representación) que interactúa con esta funcionalidad. Para cada uno indicar con claridad qué puede hacer y qué tiene prohibido hacer. Incluir quiénes nunca tienen acceso si se acordó en la entrevista.

**Forma:**
- <rol o tipo de usuario>: puede <acción permitida>. No puede <acción restringida>.

### Historias de usuario

**Llenar:** una historia por cada resultado de valor acordado para cada rol de usuario. Describir el beneficio en palabras de negocio. No incluir historias para exclusiones o elementos fuera de alcance.

**Forma:**
- Como <rol de usuario>, quiero <acción o capacidad> para <beneficio o valor esperado>.

## Requisitos funcionales

**Llenar:** la totalidad de la funcionalidad desglosada en ítems RF concisos y comprobables. Un RF equivale a un comportamiento observable (un actor + un resultado, o una regla de negocio que siempre se cumple). No mapear 1:1 con las preguntas de la entrevista. Fusionar requisitos redundantes y dividir si hay más de un resultado.

**Número:** `RF-01`, `RF-02`, ... correlativo de dos dígitos. Título en lenguaje de producto: verbo + qué cambia para el usuario.

**Criterios:** una o más viñetas bajo cada RF redactadas bajo la sintaxis EARS. Cada criterio define una condición + `debe` + **resultado observable** (lo que alguien ve en pantalla, lo que se le prohíbe hacer o la confirmación que recibe). Jamás detallar cómo está programado.

**Sintaxis EARS (elegir la forma que corresponda; pueden combinarse en un mismo RF):**
- Siempre: `<el sistema / la interfaz> debe <resultado observable>`
- Evento: `Cuando <ocurre evento del usuario o sistema>, <la interfaz / sistema> debe <resultado observable>`
- Estado: `Si <el sistema está en determinado estado>, <la interfaz> debe <resultado observable>`
- No deseado: `Si <ocurre una situación errónea o no permitida>, <el sistema> no debe <daño o acción indebida>; debe <mensaje o protección visible>`

**El conjunto de RFs debe dejar comprobables de forma obligatoria:**
- Quién tiene permiso y quién no
- El flujo principal exitoso (camino feliz)
- Casos donde no se puede continuar (falta de datos, sin permisos, conflicto o error)
- Casos de estado vacío, primera vez o ausencia de información
- Estado resultante tras la acción (datos preservados, operación deshecha o error comprensible)

**Forma:**

### RF-01 <Verbo en infinitivo + qué cambia para el usuario>
- Cuando <evento>, debe <resultado observable>
- Si <estado>, debe <resultado observable>

## Casos límite

**Llenar:** situaciones extremas o excepcionales fuera del camino feliz que fueron acordadas: colecciones vacías, primera interacción, elemento duplicado, dos acciones simultáneas, datos desactualizados, interrupción de conexión o falta de permisos en medio del proceso. Solo registrar lo acordado. Si un caso límite ya está cubierto como criterio EARS en un RF, no duplicarlo textualmente; mencionarlo solo si requiere una verificación independiente.

**Vacío:** `Ninguno más allá de los RF.`

**Forma:** viñetas. En cada una: si <situación excepcional>, entonces <resultado observable>.

## Requisitos no funcionales

**Llenar:** únicamente atributos de calidad perceptibles por el usuario final que hayan sido acordados: sensación de agilidad/rapidez de respuesta, claridad de mensajes, tolerancia de uso o tono de comunicación. Prohibido mencionar librerías, nombres de servidores o detalles técnicos internos.

**Vacío:** `Ninguno más allá de lo observable en los RF.`

**Forma:** viñetas. Cada una: <cualidad de experiencia> debe <criterio comprobable en lenguaje cotidiano>.

## Fuera de alcance

**Llenar:** qué NO hará esta entrega, heredando e integrando las exclusiones definidas en el **Fuera de alcance** de `idea.md` más cualquier descarte adicional acordado en la entrevista. Una línea por ítem, sin justificaciones largas.

**Vacío:** `Nada más de lo ya dicho en la idea.`

## Criterios de finalización

**Llenar:** contrato objetivo de aceptación. **Heredar obligatoriamente las 1 a 3 condiciones del "Listo cuando" acordadas en `idea.md`**, expandiéndolas o precisándolas para que cualquier persona pueda verificar la entrega de forma independiente sin consultar al desarrollador. Redactar exclusivamente como resultados observables. Prohibido usar jerga de commits, tickets o tareas técnicas.

**Forma:** viñetas iniciando estrictamente con:
- Se puede comprobar que: <condición observable 1 heredada de Listo cuando>
- Se puede comprobar que: <condición observable 2 heredada de Listo cuando>

## Diagramas

**Llenar:** como máximo un diagrama conceptual simple en Mermaid (`flowchart` o `sequenceDiagram`) que ilustre un flujo acordado (quién realiza qué acción, en qué orden y qué ocurre si falla). Prohibido incluir diagramas de clases, tablas de base de datos o arquitectura de software.

**Vacío:** `Ninguno.`

## Dudas abiertas

**Llenar:** cualquier aspecto que aún no sea comprobable. Fuente: verificaciones pendientes de permisos, flujos incompletos, preguntas descartadas por el tope o advertencias del auditor de QA que requieran atención futura. Cada línea debe iniciar con `[NECESITA ATENCIÓN]` seguido del punto específico. No inventar contenido ni ocultar vacíos reales.

**Vacío:** `Ninguna.` (únicamente si no existe ningún vacío pendiente de definición).
