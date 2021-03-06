describe('dc.barChart', function() {
    var id, chart, data;
    var dimension, group;

    beforeEach(function () {
        data = crossfilter(loadDateFixture());
        dimension = data.dimension(function(d) { return d3.time.day(d.dd); });
        group = dimension.group();

        id = 'bar-chart';
        appendChartID(id);

        chart = dc.barChart('#' + id);
        chart.dimension(dimension).group(group)
            .width(1100).height(200)
            .x(d3.time.scale().domain([new Date("2012/01/01"), new Date("2012/12/31")]))
            .transitionDuration(0);
    });

    describe('rendering', function () {
        beforeEach(function () {
            chart.render();
        });

        it("should set bar height using y-values from data", function() {
            forEachBar(function (bar, datum) {
                expect(+bar.attr('y')).toBe(chart.y()(datum.data.value));
            });
        });

        it("should set bar width to the minimum for a relatively small chart", function() {
            forEachBar(function (bar) {
                expect(+bar.attr('width')).toBe(1);
            });
        });

        describe("with centered bars", function() {
            beforeEach(function() {
                chart.centerBar(true).render();
            });

            it("should position bars centered around their data points", function() {
                var halfBarWidth = 0.5;
                forEachBar(function (bar, datum) {
                    var barPosition = chart.x()(datum.data.key);
                    expect(+bar.attr('x')).toBe(barPosition - halfBarWidth);
                });
            });
        });

        describe("without centered bars", function() {
            it("should position bars starting at their data points", function() {
                forEachBar(function (bar, datum) {
                    var barPosition = chart.x()(datum.data.key);
                    expect(+bar.attr('x')).toBe(barPosition);
                });
            });
        });

        describe('and then switching the group at runtime', function() {
            beforeEach(function() {
                chart.rescale(); // BUG: barWidth cannot change after initial rendering

                var domain = [new Date("5/20/2012"), new Date("8/15/2012")];

                chart.x(d3.time.scale().domain(domain))
                    .group(dimension.group().reduceSum(function(d) {
                        return +d.nvalue;
                    }))
                    .elasticY(true)
                    .centerBar(false)
                    .xUnits(d3.time.days)
                    .yAxis().ticks(5);

                chart.render();
            });

            it('should generate a bar for each datum', function() {
                expect(chart.selectAll("rect.bar").size()).toBe(6);
            });

            it('should automatically resize the bar widths', function() {
                forEachBar(function(bar) {
                    expect(bar.attr("width")).toBe("9");
                });
            });

            it('should generate bars with positions corresponding to their data', function() {
                expect(nthStack(0).nthBar(0).attr("x")).toBeWithinDelta(58, 1);
                expect(nthStack(0).nthBar(0).attr("y")).toBeWithinDelta(84, 1);
                expect(nthStack(0).nthBar(0).attr("height")).toBeWithinDelta(30, 1);

                expect(nthStack(0).nthBar(3).attr("x")).toBeWithinDelta(492, 1);
                expect(nthStack(0).nthBar(3).attr("y")).toBeWithinDelta(84, 1);
                expect(nthStack(0).nthBar(3).attr("height")).toBeWithinDelta(23, 1);

                expect(nthStack(0).nthBar(5).attr("x")).toBeWithinDelta(961, 1);
                expect(nthStack(0).nthBar(5).attr("y")).toBeWithinDelta(61, 1);
                expect(nthStack(0).nthBar(5).attr("height")).toBeWithinDelta(23, 1);
            });

            it('should generate the y-axis domain dynamically', function() {
                expect(nthYAxisText(0).text()).toMatch(/-10/);
                expect(nthYAxisText(1).text()).toMatch(/-5/);
                expect(nthYAxisText(2).text()).toBe("0");

                function nthYAxisText(n) {
                    return d3.select(chart.selectAll("g.y text")[0][n]);
                }
            });


        });

        describe('with an ordinal x domain', function () {
            var stateDimension;

            beforeEach(function () {
                stateDimension = data.dimension(function(d){ return d.state; });
                var stateGroup = stateDimension.group();
                var ordinalDomainValues = ["California", "Colorado", "Delaware", "Ontario", "Mississippi", "Oklahoma"];

                chart.rescale(); // BUG: barWidth cannot change after initial rendering

                chart.dimension(stateDimension)
                    .group(stateGroup)
                    .xUnits(dc.units.ordinal)
                    .x(d3.scale.ordinal().domain(ordinalDomainValues))
                    .barPadding(0)
                    .outerPadding(0.1)
                    .render();
            });

            it('should automatically disable the brush', function () {
                expect(chart.brushOn()).toBeFalsy();
            });

            it("should generate a bar for each ordinal domain value", function() {
                expect(chart.selectAll("rect.bar").size()).toBe(6);
            });

            it("should size the bars proportionally to the graph", function() {
                expect(+chart.select("rect.bar").attr("width")).toBe(164);
            });

            it("should position the bar based on the ordinal range", function() {
                expect(nthStack(0).nthBar(0).attr('x')).toBeWithinDelta(16, 1);
                expect(nthStack(0).nthBar(3).attr('x')).toBeWithinDelta(674, 1);
                expect(nthStack(0).nthBar(5).attr('x')).toBeWithinDelta(509, 1);
            });

            it('should fade deselected bars', function() {
                chart.filter("Ontario").filter("Colorado").redraw();
                expect(nthStack(0).nthBar(0).classed("deselected")).toBeTruthy();
                expect(nthStack(0).nthBar(1).classed("deselected")).toBeFalsy();
                expect(nthStack(0).nthBar(5).classed("deselected")).toBeFalsy();
                expect(stateDimension.top(Infinity).length).toBe(3);
            });

            it('should respect the ordering of the specified domain', function() {
                // Note that bar chart works differently from pie chart.  The bar objects (the
                // actual DOM nodes) don't get reordered by the custom ordering, but they are
                // placed so that they are drawn in the order specified.
                var ontarioXPos = nthStack(0).nthBar(5).attr('x');
                var mississippiXPos = nthStack(0).nthBar(3).attr('x');
                var oklahomaXPos = nthStack(0).nthBar(4).attr('x');

                expect(ontarioXPos).toBeLessThan(mississippiXPos);
                expect(mississippiXPos).toBeLessThan(oklahomaXPos);
            });

            describe('with elasticY enabled', function() {
                beforeEach(function() {
                    chart.elasticY(true).render();
                });

                it('should use all ordinal keys to determine the maximum y', function() {
                    expect(chart.y().domain()).toEqual([0, 3]);
                });
            });

            describe("with an unspecified domain", function() {
                beforeEach(function() {
                    chart.x(d3.scale.ordinal()).render();
                });

                it("should use alphabetical ordering", function() {
                    var data = chart.selectAll("rect.bar").data();
                    var expectedData = ["California", "Colorado", "Delaware", "Mississippi", "Oklahoma", "Ontario"];

                    expect(data.map(function(datum) { return datum.x; })).toEqual(expectedData);

                    var oldX = -Infinity;
                    forEachBar(function (bar) {
                        expect(bar.attr('x')).toBeGreaterThan(oldX);
                        oldX = bar.attr('x');
                    });
                });
            });

            describe('redrawing after changing the value accessor', function() {
                beforeEach(function() {
                    chart.valueAccessor(function() { return 30; });
                    chart.redraw();
                });

                it('should position bars based on ordinal range', function() {
                    expect(nthStack(0).nthBar(0).attr("height")).toBe("1600");
                    expect(nthStack(0).nthBar(1).attr("height")).toBe("1600");
                    expect(nthStack(0).nthBar(2).attr("height")).toBe("1600");
                });
            });
        });

        describe('with a linear x domain', function () {
            beforeEach(function () {
                var linearDimension = data.dimension(function(d){ return +d.value; });
                var linearGroup = linearDimension.group();

                chart.rescale(); // BUG: barWidth cannot change after initial rendering

                chart.dimension(linearDimension)
                    .group(linearGroup)
                    .xUnits(dc.units.integers)
                    .x(d3.scale.linear().domain([20, 70]))
                    .render();
            });

            it('should generate the correct number of bars', function() {
                expect(chart.selectAll("rect.bar").size()).toBe(5);
            });

            it('should auto size bar width', function() {
                forEachBar(function(bar) {
                    expect(bar.attr("width")).toBe("18");
                });
            });

            it('should position bars based on linear range', function() {
                expect(nthStack(0).nthBar(0).attr('x')).toBeWithinDelta(40, 1);
                expect(nthStack(0).nthBar(2).attr('x')).toBeWithinDelta(489, 1);
                expect(nthStack(0).nthBar(4).attr('x')).toBeWithinDelta(938, 1);
            });
        });


        describe('with stacked data', function () {
            describe('with positive data', function () {
                beforeEach(function () {
                    var idGroup = dimension.group().reduceSum(function(d) { return d.id; });
                    var sumGroup = dimension.group().reduceSum(function(d) { return d.value; });

                    chart
                        .brushOn(false)
                        .x(d3.time.scale().domain([new Date("2012/5/20"), new Date("2012/8/15")]))
                        .group(idGroup, "stack 0")
                        .title("stack 0", function (d) { return "stack 0: " + d.value; })
                        .stack(sumGroup, "stack 1")
                        .title("stack 1", function (d) { return "stack 1: " + d.value; })
                        .stack(sumGroup, "stack 2", function (d) { return 3; })
                        .elasticY(true)
                        .render();
                });

                it("should set the y domain to encompass all stacks", function() {
                    expect(chart.y().domain()).toEqual([0, 152]);
                });

                it("should generate each stack using its associated group", function() {
                    expect(nthStack(0).selectAll("rect.bar").size()).toBe(6);
                    expect(nthStack(1).selectAll("rect.bar").size()).toBe(6);
                    expect(nthStack(2).selectAll("rect.bar").size()).toBe(6);
                });

                it('should render the correct number of stacks', function () {
                    expect(chart.selectAll('.stack').size()).toBe(3);
                });

                it("should stack the bars", function() {
                    expect(+nthStack(0).nthBar(2).attr('y')).toBe(142);
                    expect(+nthStack(0).nthBar(4).attr('y')).toBe(144);

                    expect(+nthStack(1).nthBar(2).attr('y')).toBe(3);
                    expect(+nthStack(1).nthBar(4).attr('y')).toBe(86);

                    expect(+nthStack(2).nthBar(2).attr('y')).toBe(0);
                    expect(+nthStack(2).nthBar(4).attr('y')).toBe(83);
                });

                it('should have its own title accessor', function () {
                    expect(chart.title()({value: 1})).toBe("stack 0: 1");
                    expect(chart.title("stack 0")({value: 2})).toBe("stack 0: 2");
                    expect(chart.title("stack 1")({value: 3})).toBe("stack 1: 3");
                });

                it('should have titles rendered for extra stacks', function () {
                    nthStack(1).forEachBar(function (bar, datum) {
                        expect(bar.select("title").text()).toBe("stack 1: " + datum.data.value);
                    });
                });

                it('should default to first stack title for untitled stacks', function () {
                    nthStack(2).forEachBar(function (bar, datum) {
                        expect(bar.select("title").text()).toBe("stack 0: " + datum.data.value);
                    });
                });

                describe("with title rendering disabled", function() {
                    beforeEach(function() {
                        chart.renderTitle(false).render();
                    });

                    it("should not generate title elements", function() {
                        expect(chart.selectAll('rect.bar title').empty()).toBeTruthy();
                    });
                });

                describe('stack hiding', function () {
                    describe('first stack', function () {
                        beforeEach(function () {
                            chart.hideStack("stack 0").render();
                        });

                        it('should hide the stack', function () {
                            expect(nthStack(0).nthBar(0).attr("height")).toBe('52');
                            expect(nthStack(0).nthBar(1).attr("height")).toBe('78');
                        });

                        it('should show the stack', function () {
                            chart.showStack("stack 0").render();
                            expect(nthStack(0).nthBar(0).attr("height")).toBe('1');
                            expect(nthStack(0).nthBar(1).attr("height")).toBe('6');
                        });
                    });

                    describe('any other stack', function () {
                        beforeEach(function () {
                            chart.title("stack 2", function (d) { return "stack 2: " + d.value; });
                            chart.hideStack("stack 1").render();
                        });

                        it('should hide the stack', function () {
                            expect(nthStack(1).nthBar(0).attr("height")).toBe('24');
                            expect(nthStack(1).nthBar(1).attr("height")).toBe('24');
                        });

                        it('should show the stack', function () {
                            chart.showStack("stack 1").render();
                            expect(nthStack(1).nthBar(0).attr("height")).toBe('46');
                            expect(nthStack(1).nthBar(1).attr("height")).toBe('70');
                        });

                        it('should still show the title for a visible stack', function () {
                            nthStack(1).forEachBar(function (bar, datum) {
                                expect(bar.select("title").text()).toBe("stack 2: " + datum.data.value);
                            });
                        });
                    });

                    describe('hiding all the stacks', function () {
                        beforeEach(function () {
                            chart.hideStack("stack 0")
                                .hideStack("stack 1")
                                .hideStack("stack 2")
                                .render();
                        });

                        it('should show a blank graph', function () {
                            expect(chart.selectAll('rect.bar').size()).toBe(0);
                        });
                    });
                });
            });

            describe('with negative data', function () {
                beforeEach(function () {
                    var negativeGroup = dimension.group().reduceSum(function(d){ return d.nvalue; });

                    chart.group(negativeGroup).stack(negativeGroup).stack(negativeGroup);
                    chart.x(d3.time.scale().domain([new Date("2012/5/20"), new Date("2012/8/15")]));

                    chart.margins({top: 30, right: 50, bottom: 30, left: 30})
                        .yAxisPadding(5)
                        .elasticY(true)
                        .xUnits(d3.time.days)
                        .yAxis().ticks(5);

                    chart.rescale(); // BUG: barWidth cannot change after initial rendering

                    chart.render();
                });

                it('should generate a bar for each datum across all stacks', function () {
                    expect(chart.selectAll('rect.bar').size()).toBe(18);
                });

                it('should automatically size the bar widths', function() {
                    forEachBar(function (bar) {
                        expect(bar.attr("width")).toBe("9");
                    });
                });

                it('should generate negative bars for stack 0', function () {
                    expect(nthStack(0).nthBar(0).attr('x')).toBeWithinDelta(58, 1);
                    expect(nthStack(0).nthBar(0).attr('y')).toBeWithinDelta(73, 1);
                    expect(nthStack(0).nthBar(0).attr("height")).toBeWithinDelta(8, 1);

                    expect(nthStack(0).nthBar(3).attr('x')).toBeWithinDelta(492, 1);
                    expect(nthStack(0).nthBar(3).attr('y')).toBeWithinDelta(73, 1);
                    expect(nthStack(0).nthBar(3).attr("height")).toBeWithinDelta(6, 1);

                    expect(nthStack(0).nthBar(5).attr('x')).toBeWithinDelta(961, 1);
                    expect(nthStack(0).nthBar(5).attr('y')).toBeWithinDelta(67, 1);
                    expect(nthStack(0).nthBar(5).attr("height")).toBeWithinDelta(6, 1);
                });

                it('should generate negative bar for stack 1', function () {
                    expect(nthStack(1).nthBar(0).attr('x')).toBeWithinDelta(58, 1);
                    expect(nthStack(1).nthBar(0).attr('y')).toBeWithinDelta(81, 1);
                    expect(nthStack(1).nthBar(0).attr("height")).toBeWithinDelta(7, 1);

                    expect(nthStack(1).nthBar(3).attr('x')).toBeWithinDelta(492, 1);
                    expect(nthStack(1).nthBar(3).attr('y')).toBeWithinDelta(79, 1);
                    expect(nthStack(1).nthBar(3).attr("height")).toBeWithinDelta(5, 1);

                    expect(nthStack(1).nthBar(5).attr('x')).toBeWithinDelta(961, 1);
                    expect(nthStack(1).nthBar(5).attr('y')).toBeWithinDelta(61, 1);
                    expect(nthStack(1).nthBar(5).attr("height")).toBeWithinDelta(6, 1);
                });

                it('should generate y axis domain dynamically', function () {
                    var nthText = function(n) { return d3.select(chart.selectAll("g.y text")[0][n]); };

                    expect(nthText(0).text()).toBe("-20");
                    expect(nthText(1).text()).toBe("0");
                    expect(nthText(2).text()).toBe("20");
                });
            });
        });

        it('should not be focused by default', function() {
            expect(chart.refocused()).toBeFalsy();
        });

        describe('when focused', function() {
            beforeEach(function() {
                chart.elasticY(true).gap(1).xUnits(d3.time.days);
                chart.focus([new Date("2012/6/11"), new Date("2012/7/9")]);
            });

            it('should render the one (focused) bar', function() {
                expect(chart.selectAll("rect.bar").size()).toBe(1);
            });

            it('should resize the bar width according to the focused width', function() {
                expect(chart.select("rect.bar").attr("width")).toBe("35");
            });

            it('should reset the y-axis domain based on the focus range', function() {
                expect(chart.y().domain()).toEqual([0, 1]);
            });

            it('should redraw the x-axis scale and ticks', function() {
                chart.focus(null);
                expect(nthXAxisText(0).text()).toBe("July");
                expect(nthXAxisText(1).text()).toBe("2012");
                expect(nthXAxisText(2).text()).toBe("February");
                expect(nthXAxisText(3).text()).toBe("March");

                function nthXAxisText(n) {
                    return d3.select(chart.selectAll("g.x text")[0][n]);
                }
            });

            it('should set its focus flag', function() {
                expect(chart.refocused()).toBeTruthy();
            });

            it('should reset the focus when focused to null', function() {
                chart.focus(null);
                itBehavesLikeItWasReset();
            });

            it('should reset the focus when focused to []', function() {
                chart.focus([]);
                itBehavesLikeItWasReset();
            });

            function itBehavesLikeItWasReset() {
                expect(chart.refocused()).toBeFalsy();
                expect(chart.x().domain()).toEqual([new Date("2012/1/1"), new Date("2012/12/31")]);
            }
        });

        describe('legend hovering', function () {
            var firstItem;

            beforeEach(function () {
                chart.stack(group)
                    .legend(dc.legend().x(400).y(10).itemHeight(13).gap(5))
                    .render();

                firstItem = chart.select('g.dc-legend g.dc-legend-item');
                firstItem.on("mouseover")(firstItem.datum());
            });

            describe('when a legend item is hovered over', function () {
                it('should highlight corresponding lines and areas', function () {
                    nthStack(0).forEachBar(function (bar) {
                        expect(bar.classed("highlight")).toBeTruthy();
                    });
                });

                it('should fade out non-corresponding lines and areas', function () {
                    nthStack(1).forEachBar(function (bar) {
                        expect(bar.classed("fadeout")).toBeTruthy();
                    });
                });
            });

            describe('when a legend item is hovered out', function () {
                it('should remove highlighting from corresponding lines and areas', function () {
                    firstItem.on("mouseout")(firstItem.datum());
                    nthStack(0).forEachBar(function (bar) {
                        expect(bar.classed("highlight")).toBeFalsy();
                    });
                });

                it('should fade in non-corresponding lines and areas', function () {
                    firstItem.on("mouseout")(firstItem.datum());
                    nthStack(1).forEachBar(function (bar) {
                        expect(bar.classed("fadeout")).toBeFalsy();
                    });
                });
            });
        });

        describe('filtering', function () {
            beforeEach(function () {
                d3.select("#" + id).append("span").attr("class", "filter").style("display", "none");
                d3.select("#" + id).append("a").attr("class", "reset").style("display", "none");
                chart.filter([new Date("2012/6/1"), new Date("2012/6/30")]).redraw();
                chart.redraw();
            });

            it('should set the chart filter', function () {
                expect(chart.filter()).toEqual([new Date("2012/6/1"), new Date("2012/6/30")]);
            });

            it("should enable the reset link after rendering", function() {
                expect(chart.select("a.reset").style("display")).not.toBe("none");
            });

            it('should set the filter printer', function () {
                expect(chart.filterPrinter()).not.toBeNull();
            });

            it("should turn the filter info on", function() {
                expect(chart.select("span.filter").style("display")).not.toBe("none");
            });

            it("should set filter text after slice selection", function() {
                expect(chart.select("span.filter").text()).toBe("[06/01/2012 -> 06/30/2012]");
            });

            describe('when a brush is defined', function () {
                it('should position the brush with an offset', function () {
                    expect(chart.select("g.brush").attr("transform")).toBe("translate(" + chart.margins().left + ",10)");
                });

                it('should create a fancy brush resize handle', function () {
                    chart.select("g.brush").selectAll(".resize path").each(function (d, i) {
                        if (i === 0) {
                            expect(d3.select(this).attr("d"))
                                .toMatch(/M0.5,53.\d+A6,6 0 0 1 6.5,59.\d+V100.\d+A6,6 0 0 1 0.5,106.\d+ZM2.5,61.\d+V98.\d+M4.5,61.\d+V98.\d+/);
                        }
                        else{
                            expect(d3.select(this).attr("d"))
                                .toMatch(/M-0.5,53.\d+A6,6 0 0 0 -6.5,59.\d+V100.\d+A6,6 0 0 0 -0.5,106.\d+ZM-2.5,61.\d+V98.\d+M-4.5,61.\d+V98.\d+/);
                        }
                    });
                });

                it('should stretch the background', function () {
                    expect(+chart.select("g.brush rect.background").attr("width")).toBe(1020);
                });

                it('should set the background height to the chart height', function () {
                    expect(+chart.select("g.brush rect.background").attr("height")).toBe(160);
                });

                it('should set extent height to the chart height', function () {
                    expect(+chart.select("g.brush rect.extent").attr("height")).toBe(160);
                });

                it('should set extent width based on filter set', function () {
                    expect(chart.select("g.brush rect.extent").attr("width")).toBeWithinDelta(81, 1);
                });

                it("should push unselected bars to the background", function() {
                    expect(nthStack(0).nthBar(0).classed("deselected")).toBeTruthy();
                    expect(nthStack(0).nthBar(1).classed("deselected")).toBeFalsy();
                    expect(nthStack(0).nthBar(3).classed("deselected")).toBeTruthy();
                });

                it("should push the selected bars to the foreground", function() {
                    expect(nthStack(0).nthBar(1).classed("deselected")).toBeFalsy();
                });

                describe("after reset", function() {
                    beforeEach(function() {
                        chart.filterAll();
                        chart.redraw();
                    });

                    it("should push all bars to the foreground", function() {
                        chart.selectAll("rect.bar").each(function () {
                            var bar = d3.select(this);
                            expect(bar.classed("deselected")).toBeFalsy();
                        });
                    });
                });
            });
        });

        describe("a chart with a large domain", function() {
            beforeEach(function() {
                chart.x(d3.time.scale().domain([new Date("2000/01/01"), new Date("2012/12/31")]));
            });

            describe("when filters are applied", function() {
                beforeEach(function() {
                    data.dimension(function(d){ return d.value; }).filter(66);
                    chart.redraw();
                });

                it("should not deselect any bars", function() {
                    forEachBar(function (bar) {
                        expect(bar.classed("deselected")).toBeFalsy();
                    });
                });

                it("should set the bars to the minimum bar width", function() {
                    forEachBar(function (bar) {
                        expect(+bar.attr("width")).toBe(1);
                    });
                });
            });
        });

        describe("a chart with a linear numerical domain", function() {
            beforeEach(function() {
                var numericalDimension = data.dimension(function(d) { return +d.value; });
                chart.dimension(numericalDimension).group(numericalDimension.group());
                chart.x(d3.scale.linear().domain([10, 80])).elasticY(true);
                chart.render();
            });

            it("should base the y-axis height on the maximum value in the data", function() {
                var yAxisMax = 3.0;
                var ticks = chart.selectAll("g.y g.tick");
                var tickValues = ticks[0].map(function (tick) { return +d3.select(tick).text(); });
                var maxTickValue = Math.max.apply(this, tickValues);
                expect(maxTickValue).toBe(yAxisMax);
            });

            describe("when filters are applied", function() {
                beforeEach(function() {
                    data.dimension(function(d) { return d.countrycode; }).filter("CA");
                    chart.redraw();
                });

                it("should rescale the y-axis after applying a filter", function() {
                    var yAxisMax = 1.0;
                    var ticks = chart.selectAll("g.y g.tick");
                    var tickValues = ticks[0].map(function (tick) { return +d3.select(tick).text(); });
                    var maxTickValue = Math.max.apply(this, tickValues);
                    expect(maxTickValue).toBe(yAxisMax);
                });
            });
        });
    });

    describe("brushing with bars centered and rounding enabled", function () {
        beforeEach(function () {
            chart
                .brushOn(true)
                .round(d3.time.month.round)
                .centerBar(true);
        });

        describe("with alwaysUseRounding disabled", function() {
            var consoleWarnSpy;

            beforeEach(function() {
                chart.alwaysUseRounding(false);
                consoleWarnSpy = spyOn(console, "warn");
                chart.render();
                chart.brush().extent([new Date(2012, 6, 1), new Date(2012, 7, 15)]);
                chart.brush().event(chart.root());
            });

            it("should log a warning indicating that brush rounding was disabled", function () {
                expect(consoleWarnSpy.calls.mostRecent().args[0]).toMatch(/brush rounding is disabled/);
            });

            it("should not round the brush", function () {
                expect(chart.filter()).toEqual([new Date(2012, 6, 1), new Date(2012, 7, 15)]);
            });
        });

        describe("with alwaysUseRounding enabled", function() {
            beforeEach(function() {
                chart.alwaysUseRounding(true);
                chart.render();
                chart.brush().extent([new Date(2012, 6, 1), new Date(2012, 7, 15)]);
                chart.brush().event(chart.root());
            });

            it("should round the brush", function () {
                expect(chart.brush().extent()).toEqual([new Date(2012, 6, 1), new Date(2012, 7, 1)]);
            });
        });
    });

    function nthStack(n) {
        var stack = d3.select(chart.selectAll(".stack")[0][n]);

        stack.nthBar = function (n) {
            return d3.select(this.selectAll("rect.bar")[0][n]);
        };

        stack.forEachBar = function (assertions) {
            this.selectAll("rect.bar").each(function (d) {
                assertions(d3.select(this), d);
            });
        };

        return stack;
    }

    function forEachBar(assertions) {
        chart.selectAll("rect.bar").each(function (d) {
            assertions(d3.select(this), d);
        });
    }
});
